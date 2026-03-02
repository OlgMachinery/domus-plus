import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl } from '@/lib/storage/spaces'
import { extractReceiptFromImageBytes, extractReceiptFromImageParts } from '@/lib/receipts/extract'

export const dynamic = 'force-dynamic'

function guessMimeFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const p = u.pathname.toLowerCase()
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
    if (p.endsWith('.png')) return 'image/png'
    if (p.endsWith('.webp')) return 'image/webp'
    return null
  } catch {
    return null
  }
}

function isSupportedImage(mime: string | null) {
  if (!mime) return false
  return mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp'
}

function asNumber(value: any): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === 'number' ? value : Number(String(value))
  return Number.isFinite(n) ? n : null
}

function asDecimalString(value: number | null, digits = 2): string | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  const p = 10 ** digits
  const rounded = Math.round(value * p) / p
  return String(rounded)
}

function parseDateOnly(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function mapExtractionForResponse(ext: any) {
  const receiptDateIso =
    ext?.receiptDate instanceof Date ? ext.receiptDate.toISOString().slice(0, 10) : ext?.receiptDate ? String(ext.receiptDate) : null
  const items = Array.isArray(ext?.items) ? ext.items : []
  return {
    id: ext.id,
    merchantName: ext.merchantName ?? null,
    date: receiptDateIso,
    total: asNumber(ext.total),
    currency: ext.currency ?? null,
    tax: asNumber(ext.tax),
    tip: asNumber(ext.tip),
    rawText: ext.rawText ?? null,
    meta: (() => {
      try {
        return ext.metaJson ? JSON.parse(String(ext.metaJson)) : null
      } catch {
        return null
      }
    })(),
    items: items
      .slice()
      .sort((a: any, b: any) => Number(a?.lineNumber || 0) - Number(b?.lineNumber || 0))
      .map((it: any) => ({
        id: it.id,
        lineNumber: Number(it.lineNumber || 0) || 0,
        description: it.description,
        rawLine: it.rawLine ?? null,
        quantity: asNumber(it.quantity),
        unitPrice: asNumber(it.unitPrice),
        amount: asNumber(it.amount),
        isAdjustment: !!it.isAdjustment,
        isPlaceholder: !!it.isPlaceholder,
        lineType: it.lineType ?? null,
      })),
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId } = await requireMembership(req)
    const body = await req.json().catch(() => ({}))
    const force = body?.force === true
    const mode = body?.mode === 'fast' ? 'fast' : 'precise'

    const { id } = await params

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        fileUrl: true,
        transactionId: true,
        userId: true,
        images: { select: { fileUrl: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)

    // Si ya existe extracción, devolverla (idempotente) salvo que se pida force
    if (!force) {
      const existing = await prisma.receiptExtraction.findUnique({
        where: { receiptId: receipt.id },
        include: { items: true },
      })
      if (existing) {
        return NextResponse.json(
          {
            ok: true,
            receiptId: receipt.id,
            transactionId: receipt.transactionId,
            message: 'Ticket ya extraído.',
            extraction: mapExtractionForResponse(existing),
          },
          { status: 200 }
        )
      }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return jsonError('Falta OPENAI_API_KEY en el servidor', 500)
    const model = process.env.OPENAI_RECEIPT_MODEL || 'gpt-4o-mini'

    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { currency: true },
    })
    const _currency = family?.currency || 'MXN'

    const fileUrls = Array.isArray(receipt.images) && receipt.images.length ? receipt.images.map((i) => i.fileUrl) : [receipt.fileUrl]

    async function downloadImage(fileUrl: string) {
      let downloadUrl = fileUrl
      const key = extractKeyFromSpacesUrl(fileUrl)
      if (key) {
        try {
          downloadUrl = await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 10 })
        } catch {
          // si no se puede firmar, intentamos con fileUrl directo
        }
      }

      const fileRes = await fetch(downloadUrl, { cache: 'no-store' })
      if (!fileRes.ok) throw new Error('No se pudo descargar el recibo')

      const contentTypeRaw = fileRes.headers.get('content-type')
      const contentType = contentTypeRaw ? contentTypeRaw.split(';')[0]?.trim().toLowerCase() : null
      const mime = isSupportedImage(contentType) ? contentType : guessMimeFromUrl(downloadUrl)
      if (!isSupportedImage(mime)) throw new Error('Formato no soportado. Sube una imagen (JPG/PNG/WebP).')

      const bytes = Buffer.from(await fileRes.arrayBuffer())
      if (bytes.length < 1) throw new Error('El archivo está vacío')
      return bytes
    }

    let imagesBytes: Buffer[] = []
    try {
      imagesBytes = await Promise.all(fileUrls.map(downloadImage))
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : 'No se pudo descargar el recibo'
      const lower = msg.toLowerCase()
      if (lower.includes('formato no soportado')) return jsonError(msg, 415)
      if (lower.includes('archivo está vacío') || lower.includes('archivo esta vacio')) return jsonError(msg, 400)
      return jsonError(msg, 502)
    }

    const extraction =
      imagesBytes.length > 1
        ? await extractReceiptFromImageParts({ apiKey, model, imageParts: imagesBytes, mode })
        : await extractReceiptFromImageBytes({ apiKey, model, imageBytes: imagesBytes[0]!, mode })

    const receiptDate = parseDateOnly(extraction.date)

    const saved = await prisma.$transaction(async (tx) => {
      const ext = await tx.receiptExtraction.upsert({
        where: { receiptId: receipt.id },
        create: {
          receiptId: receipt.id,
          familyId,
          userId: receipt.userId,
          merchantName: extraction.merchantName,
          receiptDate,
          total: asDecimalString(extraction.total, 2),
          currency: extraction.currency,
          tax: asDecimalString(extraction.tax, 2),
          tip: asDecimalString(extraction.tip, 2),
          rawText: extraction.rawText,
          rawJson: JSON.stringify(extraction.raw),
          metaJson: JSON.stringify(extraction.meta),
        },
        update: {
          merchantName: extraction.merchantName,
          receiptDate,
          total: asDecimalString(extraction.total, 2),
          currency: extraction.currency,
          tax: asDecimalString(extraction.tax, 2),
          tip: asDecimalString(extraction.tip, 2),
          rawText: extraction.rawText,
          rawJson: JSON.stringify(extraction.raw),
          metaJson: JSON.stringify(extraction.meta),
        },
        select: { id: true },
      })

      await tx.receiptExtractionItem.deleteMany({ where: { extractionId: ext.id } })

      if (extraction.items.length) {
        await tx.receiptExtractionItem.createMany({
          data: extraction.items.map((it) => ({
            extractionId: ext.id,
            lineNumber: it.lineNumber,
            description: it.description,
            rawLine: it.rawLine,
            quantity: asDecimalString(it.quantity, 3),
            unitPrice: asDecimalString(it.unitPrice, 2),
            amount: asDecimalString(it.amount, 2),
            isAdjustment: it.isAdjustment,
            isPlaceholder: it.isPlaceholder,
            lineType: it.lineType,
            notesJson: JSON.stringify(it.notes || {}),
          })),
        })
      }

      return ext
    })

    const full = await prisma.receiptExtraction.findFirst({
      where: { id: saved.id },
      include: { items: true },
    })
    if (!full) return jsonError('No se pudo guardar la extracción', 500)

    return NextResponse.json(
      {
        ok: true,
        receiptId: receipt.id,
        transactionId: receipt.transactionId,
        message: 'Ticket extraído correctamente y guardado.',
        extraction: mapExtractionForResponse(full),
      },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo extraer el ticket'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

