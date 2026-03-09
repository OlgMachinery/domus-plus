import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { uploadToSpaces } from '@/lib/storage/spaces'
import { generateRegistrationCode } from '@/lib/registration-code'

export const dynamic = 'force-dynamic'

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
}

function toDecimal(value: unknown): number | null {
  if (value == null) return null
  const n = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId: adminUserId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede registrar la entrega', 403)
    const { id: moneyRequestId } = await params

    const mr = await prisma.moneyRequest.findFirst({
      where: { id: moneyRequestId, familyId },
      select: {
        id: true,
        status: true,
        amount: true,
        allocationId: true,
        date: true,
        reason: true,
        createdByUserId: true,
      },
    })
    if (!mr) return jsonError('Solicitud no encontrada', 404)
    if (mr.status !== 'APPROVED') return jsonError('La solicitud debe estar aprobada para registrar entrega', 400)

    const form = await req.formData()
    const rawFiles = form.getAll('file')
    const files = rawFiles.filter((f) => f instanceof File) as File[]
    if (!files.length) return jsonError('Debes adjuntar al menos 1 imagen (comprobante de la transferencia)', 400)
    if (files.length > 8) return jsonError('Máximo 8 fotos', 400)

    const amountSentRaw = form.get('amountSent') ?? form.get('amount')
    const amountSent = toDecimal(amountSentRaw)
    const allocationIdFromForm = typeof form.get('allocationId') === 'string' ? form.get('allocationId') as string : ''
    const allocationId = allocationIdFromForm || mr.allocationId
    if (!allocationId) return jsonError('Indica la asignación (partida/categoría) para el egreso', 400)

    const alloc = await prisma.entityBudgetAllocation.findUnique({
      where: { id: allocationId },
      select: { familyId: true },
    })
    if (!alloc || alloc.familyId !== familyId) return jsonError('Asignación no encontrada o sin acceso', 403)

    const finalAmount = amountSent ?? Number(mr.amount)
    const date = mr.date

    const registrationCode = await generateRegistrationCode(prisma, familyId, 'E')
    const uploaded = await Promise.all(
      files.map(async (file, idx) => {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = Buffer.from(arrayBuffer)
        if (bytes.length < 1) throw new Error('El archivo está vacío')
        const key = `families/${familyId}/transactions/${moneyRequestId}-deliver/${Date.now()}-${idx + 1}-${safeName(file.name)}`
        const fileUrl = await uploadToSpaces({
          key,
          body: bytes,
          contentType: file.type || 'application/octet-stream',
        })
        return { fileUrl, sortOrder: idx + 1 }
      })
    )
    const coverUrl = uploaded[uploaded.length - 1]?.fileUrl || uploaded[0]!.fileUrl

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          familyId,
          userId: mr.createdByUserId,
          allocationId,
          amount: String(finalAmount),
          date,
          description: `Solicitud efectivo: ${mr.reason}`,
          registrationCode,
        },
        select: { id: true, registrationCode: true },
      }),
    ])

    const receipt = await prisma.receipt.create({
      data: {
        transactionId: transaction.id,
        userId: adminUserId,
        familyId,
        fileUrl: coverUrl,
        images: {
          create: uploaded.map((u) => ({ fileUrl: u.fileUrl, sortOrder: u.sortOrder })),
        },
      },
      select: { id: true },
    })

    await prisma.receiptExtraction.create({
      data: {
        receiptId: receipt.id,
        familyId,
        userId: adminUserId,
        merchantName: `Solicitud efectivo: ${(mr.reason || '').slice(0, 180)}`,
        total: finalAmount,
        receiptDate: date,
        currency: 'MXN',
      },
    })

    await prisma.moneyRequest.update({
      where: { id: moneyRequestId },
      data: { status: 'DELIVERED', transactionId: transaction.id, deliveredAt: new Date() },
    })

    return NextResponse.json(
      {
        ok: true,
        transactionId: transaction.id,
        registrationCode: transaction.registrationCode,
        amount: finalAmount,
      },
      { status: 201 }
    )
  } catch (e: any) {
    const raw = typeof e?.message === 'string' ? e.message : 'No se pudo registrar la entrega'
    if (raw.includes('Falta') || raw.includes('Spaces') || raw.includes('DO_SPACES')) {
      return jsonError('Falta configurar DigitalOcean Spaces (DO_SPACES_*).', 400)
    }
    if (e?.message === 'No autenticado' || e?.message === 'No hay familia activa') return jsonError(e.message, 401)
    return jsonError(raw, 500)
  }
}
