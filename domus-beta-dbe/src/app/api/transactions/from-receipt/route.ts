import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { uploadToSpaces } from '@/lib/storage/spaces'
import { extractReceiptFromImageBytes, extractReceiptFromImageParts } from '@/lib/receipts/extract'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'
import { generateRegistrationCode, type PrismaLike } from '@/lib/registration-code'
import { suggestAllocationForReceipt, type AllocationOption } from '@/lib/agent/domus-agent'
import { findPossibleDuplicate } from '@/lib/dedup'

export const dynamic = 'force-dynamic'

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
}

function parseDateOnly(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const s = String(dateStr).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function asDecimalString(value: number | null, digits = 2): string | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  const p = 10 ** digits
  const rounded = Math.round(value * p) / p
  return String(rounded)
}

function normalizeText(value: any) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
}

function inferCategoryHint(args: { merchantName: string | null; rawText: string | null }) {
  const text = `${args.merchantName || ''} ${args.rawText || ''}`.toUpperCase()
  if (/(HEB|H-E-B|WALMART|SORIANA|COSTCO|CHEDRAUI|SUPERAMA|SAMS|SMART)/.test(text)) return 'Supermercado'
  if (/(PEMEX|SHELL|BP\\b|GASOLIN|OXXO\\s*GAS)/.test(text)) return 'Gasolina'
  if (/(FARMACIA|BENAVIDES|GUADALAJARA|AHORRO)/.test(text)) return 'Farmacia'
  if (/(RESTAUR|PIZZA|BURGER|SUSHI|TAQUER|CAFE|STARBUCKS)/.test(text)) return 'Restaurantes'
  if (/(VETERIN|MASCOT)/.test(text)) return 'Mascotas'
  return null
}

function scoreAllocation(args: { allocation: any; hint: string | null; userName: string }) {
  const { allocation, hint, userName } = args
  const catName = normalizeText(allocation?.category?.name)
  const entType = String(allocation?.entity?.type || '')
  const entName = normalizeText(allocation?.entity?.name)
  const hintNorm = hint ? normalizeText(hint) : null

  let score = 0
  if (hintNorm && catName.includes(hintNorm)) score += 100
  if (!hintNorm && entType === 'HOUSE') score += 2

  if (hintNorm === 'supermercado' && entType === 'HOUSE') score += 10
  if (hintNorm === 'gasolina' && entType === 'VEHICLE') score += 10
  if (hintNorm === 'mascotas' && entType === 'PET') score += 10

  if (userName && entName && entName.includes(normalizeText(userName))) score += 2

  const limit = Number(String(allocation?.monthlyLimit || 0))
  if (Number.isFinite(limit) && limit > 0) score += Math.min(5, Math.log10(limit + 1))
  return score
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return jsonError('Falta OPENAI_API_KEY en el servidor', 500)
    const model = process.env.OPENAI_RECEIPT_MODEL || 'gpt-4o-mini'

    const form = await req.formData()
    const rawFiles = form.getAll('file')
    const files = rawFiles.filter((f) => f instanceof File) as File[]
    if (!files.length) return jsonError('Debes adjuntar al menos 1 foto (file)', 400)
    if (files.length > 8) return jsonError('Demasiadas fotos. Sube máximo 8.', 400)

    const allocationIdOverride = typeof form.get('allocationId') === 'string' ? String(form.get('allocationId') || '').trim() : ''
    const assignToUserIdRaw = typeof form.get('assignToUserId') === 'string' ? String(form.get('assignToUserId') || '').trim() : ''
    const forceDuplicate = form.get('forceDuplicate') === '1' || form.get('forceDuplicate') === 'true'
    let transactionUserId = userId
    if (assignToUserIdRaw) {
      const member = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId, userId: assignToUserIdRaw } },
        select: { userId: true },
      })
      if (!member) return jsonError('Ese usuario no pertenece a la familia', 403)
      transactionUserId = member.userId
    }

    const user = await prisma.user.findUnique({ where: { id: transactionUserId }, select: { name: true, email: true } })
    const userName = user?.name || user?.email || ''

    // 1) Convertir a bytes (una sola vez) y subir a Spaces — guardamos en “inbox” por familia
    const parts = await Promise.all(
      files.map(async (file, idx) => {
        const ab = await file.arrayBuffer()
        const bytes = Buffer.from(ab)
        if (bytes.length < 1) throw new Error('El archivo está vacío')
        return { file, idx, bytes }
      })
    )

    const imagesBytes: Buffer[] = parts.map((p) => p.bytes)

    const uploaded = await Promise.all(
      parts.map(async (p) => {
        const key = `families/${familyId}/receipts/inbox/${Date.now()}-${p.idx + 1}-${safeName(p.file.name)}`
        const fileUrl = await uploadToSpaces({
          key,
          body: p.bytes,
          contentType: p.file.type || 'application/octet-stream',
        })
        return { fileUrl, sortOrder: p.idx + 1 }
      })
    )

    const coverUrl = uploaded[uploaded.length - 1]?.fileUrl || uploaded[0]!.fileUrl

    // 3) Extraer ticket con IA (antes de persistir extracción)
    const mode: 'fast' | 'precise' = 'precise'
    const extraction =
      imagesBytes.length > 1
        ? await extractReceiptFromImageParts({ apiKey, model, imageParts: imagesBytes, mode })
        : await extractReceiptFromImageBytes({ apiKey, model, imageBytes: imagesBytes[0]!, mode })

    const total = typeof extraction?.total === 'number' ? extraction.total : null
    if (!total || total <= 0) {
      return jsonError('No se pudo leer el total del ticket. Reintenta con fotos más nítidas o registra el gasto sin comprobante.', 400)
    }

    // C5: validar fecha de extracción — si es futura o >12 meses, usar hoy
    let receiptDate = parseDateOnly(extraction?.date || null)
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    if (receiptDate) {
      if (receiptDate > now) receiptDate = now
      else if (receiptDate < twelveMonthsAgo) receiptDate = now
    }
    const txDate = receiptDate || new Date()

    // 4) Elegir asignación (cuenta); si el gasto es para otro usuario, preferir partidas de sus entidades
    let allocationId = allocationIdOverride
    if (allocationId) {
      const alloc = await prisma.entityBudgetAllocation.findUnique({ where: { id: allocationId }, select: { id: true, familyId: true, isActive: true } })
      if (!alloc) return jsonError('Asignación no encontrada', 404)
      if (alloc.familyId !== familyId) return jsonError('No tienes acceso a esa asignación', 403)
      if (!alloc.isActive) return jsonError('Esa asignación está inactiva', 409)
    } else {
      let allocs = await prisma.entityBudgetAllocation.findMany({
        where: { familyId, isActive: true, entity: { isActive: true, participatesInBudget: true }, category: { isActive: true } },
        select: {
          id: true,
          entityId: true,
          monthlyLimit: true,
          entity: { select: { id: true, name: true, type: true } },
          category: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'asc' },
      })
      if (transactionUserId !== userId) {
        const ownedEntityIds = await prisma.budgetEntityOwner.findMany({
          where: { familyId, userId: transactionUserId },
          select: { entityId: true },
        }).then((r) => r.map((x) => x.entityId))
        const forUser = allocs.filter((a) => ownedEntityIds.includes(a.entityId))
        if (forUser.length) allocs = forUser
      }
      if (!allocs.length) return jsonError('No hay asignaciones activas. Ve a Presupuesto y configura montos.', 409)

      const merchantName = extraction?.merchantName || null
      const rawText = extraction?.rawText || null
      let categoryHintFromPreference: string | null = null
      if (merchantName && merchantName.trim().length >= 2) {
        const key = normalizeText(merchantName).slice(0, 80)
        const pref = await prisma.familyCategoryPreference.findUnique({
          where: { familyId_preferenceKey: { familyId, preferenceKey: key } },
          select: { category: { select: { name: true } } },
        })
        if (pref?.category?.name) categoryHintFromPreference = pref.category.name
      }
      const allocationOptions: AllocationOption[] = allocs.map((a) => ({
        id: a.id,
        entityName: a.entity?.name ?? '',
        categoryName: a.category?.name ?? '',
      }))
      const suggestedId = await suggestAllocationForReceipt(
        merchantName ?? '',
        rawText ?? '',
        allocationOptions,
        categoryHintFromPreference,
      )
      if (suggestedId) {
        allocationId = suggestedId
      } else {
        const hint = inferCategoryHint({ merchantName, rawText })
        let best = allocs[0]!
        let bestScore = scoreAllocation({ allocation: best, hint, userName })
        for (const a of allocs) {
          const s = scoreAllocation({ allocation: a, hint, userName })
          if (s > bestScore) {
            best = a
            bestScore = s
          }
        }
        allocationId = best.id
      }
    }

    const amountStr = asDecimalString(total, 2)
    const taxStr = asDecimalString(typeof extraction?.tax === 'number' ? extraction.tax : null, 2)
    const tipStr = asDecimalString(typeof extraction?.tip === 'number' ? extraction.tip : null, 2)

    const description = extraction?.merchantName ? String(extraction.merchantName).trim() : 'Gasto con comprobante'

    const duplicateBeforeCreate = await findPossibleDuplicate(prisma, familyId, {
      amount: Number(total),
      date: txDate,
      descriptionOrMerchant: description || null,
      excludeTransactionId: undefined,
    })
    if (duplicateBeforeCreate && !forceDuplicate) {
      return NextResponse.json(
        {
          ok: false,
          code: 'POSSIBLE_DUPLICATE',
          message: 'Posible duplicado. Elige descartar o registrar de todos modos.',
          duplicateWarning: {
            transactionId: duplicateBeforeCreate.transactionId,
            date: duplicateBeforeCreate.date,
            description: duplicateBeforeCreate.description,
            amount: duplicateBeforeCreate.amount,
          },
        },
        { status: 409 }
      )
    }

    const created = await prisma.$transaction(async (tx) => {
      const registrationCode = await generateRegistrationCode(tx as PrismaLike, familyId, 'E')
      const t = await tx.transaction.create({
        data: {
          familyId,
          userId: transactionUserId,
          allocationId,
          amount: amountStr || String(total),
          date: txDate,
          description,
          registrationCode,
        },
        select: { id: true, registrationCode: true },
      })

      const receipt = await tx.receipt.create({
        data: {
          transactionId: t.id,
          userId: transactionUserId,
          familyId,
          fileUrl: coverUrl,
          images: {
            create: uploaded.map((u) => ({ fileUrl: u.fileUrl, sortOrder: u.sortOrder })),
          },
        },
        select: { id: true },
      })

      const consumptionPeriodStart = extraction?.consumptionPeriodStart
        ? parseDateOnly(String(extraction.consumptionPeriodStart))
        : null
      const consumptionPeriodEnd = extraction?.consumptionPeriodEnd
        ? parseDateOnly(String(extraction.consumptionPeriodEnd))
        : null

      const ext = await tx.receiptExtraction.create({
        data: {
          receiptId: receipt.id,
          familyId,
          userId: transactionUserId,
          merchantName: extraction?.merchantName || null,
          receiptDate,
          total: amountStr,
          currency: extraction?.currency || null,
          tax: taxStr,
          tip: tipStr,
          rawText: extraction?.rawText || null,
          rawJson: JSON.stringify(extraction?.raw || {}),
          metaJson: JSON.stringify(extraction?.meta || {}),
          receiptType: extraction?.receiptType ?? null,
          consumptionQuantity:
            extraction?.consumptionQuantity != null && Number.isFinite(Number(extraction.consumptionQuantity))
              ? String(extraction.consumptionQuantity)
              : null,
          consumptionUnit: extraction?.consumptionUnit ?? null,
          consumptionPeriodStart,
          consumptionPeriodEnd,
        },
        select: { id: true },
      })

      if (Array.isArray(extraction?.items) && extraction.items.length) {
        await tx.receiptExtractionItem.createMany({
          data: extraction.items.map((it: any) => ({
            extractionId: ext.id,
            lineNumber: Number(it?.lineNumber || 0) || 0,
            description: String(it?.description || ''),
            rawLine: it?.rawLine ? String(it.rawLine) : null,
            quantity: asDecimalString(typeof it?.quantity === 'number' ? it.quantity : null, 3),
            unitPrice: asDecimalString(typeof it?.unitPrice === 'number' ? it.unitPrice : null, 2),
            amount: asDecimalString(typeof it?.amount === 'number' ? it.amount : null, 2),
            isAdjustment: !!it?.isAdjustment,
            isPlaceholder: !!it?.isPlaceholder,
            lineType: it?.lineType ? String(it.lineType) : null,
            notesJson: JSON.stringify(it?.notes || {}),
            quantityUnit: it?.quantityUnit ? String(it.quantityUnit) : null,
          })),
        })
      }

      return { transactionId: t.id, receiptId: receipt.id, registrationCode: t.registrationCode }
    })

    const duplicateWarning = await findPossibleDuplicate(prisma, familyId, {
      amount: Number(total),
      date: txDate,
      descriptionOrMerchant: description || null,
      excludeTransactionId: created.transactionId,
    })

    return NextResponse.json(
      {
        ok: true,
        transactionId: created.transactionId,
        receiptId: created.receiptId,
        registrationCode: created.registrationCode ?? null,
        message: 'Gasto agregado con comprobante. Ticket extraído correctamente.',
        ...(duplicateWarning && { duplicateWarning }),
      },
      { status: 201 }
    )
  } catch (e: any) {
    const raw = typeof e?.message === 'string' ? e.message : 'No se pudo agregar el gasto con comprobante'
    const code =
      (typeof e?.Code === 'string' && e.Code) ||
      (typeof e?.code === 'string' && e.code) ||
      (typeof e?.name === 'string' && e.name) ||
      ''
    const httpStatus = typeof e?.$metadata?.httpStatusCode === 'number' ? e.$metadata.httpStatusCode : null
    const lower = `${raw} ${code}`.toLowerCase()

    if (
      lower.includes('faltan variables do_spaces_') ||
      lower.includes('falta do_spaces_bucket') ||
      lower.includes('falta configuración de spaces') ||
      raw.includes('Faltan variables DO_SPACES_') ||
      raw.includes('Falta configuración de Spaces')
    ) {
      return jsonError('Falta configurar DigitalOcean Spaces (DO_SPACES_*).', 400)
    }
    if (lower.includes('archivo está vacío') || lower.includes('archivo esta vacio')) {
      return jsonError('El archivo está vacío', 400)
    }
    if (code === 'NoSuchBucket' || lower.includes('bucket does not exist') || lower.includes('nosuchbucket')) {
      return jsonError('El bucket de DigitalOcean Spaces no existe. Revisa DO_SPACES_BUCKET y la región (DO_SPACES_REGION).', 400)
    }
    if (code === 'InvalidAccessKeyId' || lower.includes('invalidaccesskeyid')) {
      return jsonError(
        'La llave de DigitalOcean Spaces (DO_SPACES_KEY) es inválida (InvalidAccessKeyId). Verifica que sea un “Spaces Access Key” y no un token, y que esté bien copiada.',
        400
      )
    }
    if (code === 'SignatureDoesNotMatch' || lower.includes('signaturedoesnotmatch')) {
      return jsonError(
        'La secret de DigitalOcean Spaces (DO_SPACES_SECRET) no coincide con la llave (SignatureDoesNotMatch). Verifica que copiaste la secret correcta.',
        400
      )
    }
    if (code === 'AccessDenied' || lower.includes('access denied') || lower.includes('accessdenied') || httpStatus === 403) {
      return jsonError(
        'Las llaves de DigitalOcean Spaces no tienen permiso para ese bucket (AccessDenied). Revisa permisos o genera una llave con acceso al Space/bucket.',
        400
      )
    }

    const safeDetail = code && raw !== code ? `${raw} (${code})` : raw
    return jsonError(safeDetail, 500)
  }
}

