import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, familyId: true, transactionId: true },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)

    const ext = await prisma.receiptExtraction.findUnique({
      where: { receiptId: receipt.id },
      include: { items: true },
    })
    if (!ext) return jsonError('Aún no se ha extraído este ticket', 404)

    return NextResponse.json(
      { ok: true, receiptId: receipt.id, transactionId: receipt.transactionId, extraction: mapExtractionForResponse(ext) },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo cargar la extracción'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    if (body?.merchantName !== undefined || body?.total !== undefined) {
      return jsonError('Por seguridad, no se permite editar el proveedor (merchant) ni el total.', 400)
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, familyId: true, transactionId: true },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)

    const ext = await prisma.receiptExtraction.findUnique({
      where: { receiptId: receipt.id },
      select: { id: true },
    })
    if (!ext) return jsonError('Primero extrae el ticket antes de editarlo.', 409)

    const patch: any = {}

    if (body?.date !== undefined) {
      const d = typeof body.date === 'string' ? parseDateOnly(body.date) : null
      if (!d) return jsonError('Fecha inválida (date). Usa YYYY-MM-DD.', 400)
      patch.receiptDate = d
    }
    if (body?.tax !== undefined) {
      const n = body.tax === null ? null : asNumber(body.tax)
      if (body.tax !== null && n === null) return jsonError('Tax inválido', 400)
      patch.tax = n === null ? null : asDecimalString(n, 2)
    }
    if (body?.tip !== undefined) {
      const n = body.tip === null ? null : asNumber(body.tip)
      if (body.tip !== null && n === null) return jsonError('Tip inválido', 400)
      patch.tip = n === null ? null : asDecimalString(n, 2)
    }

    const itemPatches = Array.isArray(body?.items) ? body.items : null

    await prisma.$transaction(async (tx) => {
      if (Object.keys(patch).length) {
        await tx.receiptExtraction.update({
          where: { id: ext.id },
          data: patch,
        })
      }

      if (itemPatches) {
        for (const it of itemPatches) {
          const itemId = typeof it?.id === 'string' ? it.id : ''
          if (!itemId) continue

          const data: any = {}
          if (it?.description !== undefined) {
            const s = typeof it.description === 'string' ? it.description.trim() : ''
            if (!s) throw new Error('Descripción requerida')
            data.description = s
          }
          if (it?.quantity !== undefined || it?.unitPrice !== undefined || it?.amount !== undefined) {
            throw new Error('Por seguridad, solo se permite editar el concepto (descripción) de los items.')
          }

          if (!Object.keys(data).length) continue

          // Seguridad: solo permite editar items de esta extracción
          await tx.receiptExtractionItem.updateMany({
            where: { id: itemId, extractionId: ext.id },
            data,
          })
        }
      }
    })

    const full = await prisma.receiptExtraction.findUnique({
      where: { receiptId: receipt.id },
      include: { items: true },
    })
    if (!full) return jsonError('No se pudo actualizar la extracción', 500)

    return NextResponse.json(
      {
        ok: true,
        receiptId: receipt.id,
        transactionId: receipt.transactionId,
        message: 'Ticket actualizado correctamente.',
        extraction: mapExtractionForResponse(full),
      },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo editar el ticket'
    const status =
      msg === 'No autenticado'
        ? 401
        : msg === 'No hay familia activa'
          ? 400
          : msg === 'No tienes acceso a esta familia'
            ? 403
            : msg === 'Descripción requerida' || msg.includes('inválid')
              ? 400
              : 500
    return jsonError(msg, status)
  }
}

