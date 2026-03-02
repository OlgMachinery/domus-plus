import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

function mapExtractionForResponse(ext: any) {
  const receiptDateIso =
    ext?.receiptDate instanceof Date ? ext.receiptDate.toISOString().slice(0, 10) : ext?.receiptDate ? String(ext.receiptDate) : null
  return {
    id: ext.id,
    merchantName: ext.merchantName ?? null,
    date: receiptDateIso,
    total: ext.total !== null && ext.total !== undefined ? Number(ext.total) : null,
    currency: ext.currency ?? null,
    tax: ext.tax !== null && ext.tax !== undefined ? Number(ext.tax) : null,
    tip: ext.tip !== null && ext.tip !== undefined ? Number(ext.tip) : null,
    confirmedAt: ext.confirmedAt ? new Date(ext.confirmedAt).toISOString() : null,
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const { id } = await params

    const body = (await req.json().catch(() => ({}))) as any
    const allocationId = typeof body?.allocationId === 'string' ? body.allocationId.trim() : ''

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, familyId: true, transactionId: true },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)

    if (allocationId) {
      const alloc = await prisma.entityBudgetAllocation.findUnique({ where: { id: allocationId }, select: { id: true, familyId: true, isActive: true } })
      if (!alloc) return jsonError('Asignación no encontrada', 404)
      if (alloc.familyId !== familyId) return jsonError('No tienes acceso a esa asignación', 403)
      if (!alloc.isActive) return jsonError('Esa asignación está inactiva', 409)
    }

    const ext = await prisma.receiptExtraction.findUnique({
      where: { receiptId: receipt.id },
      select: { id: true, merchantName: true, total: true, confirmedAt: true },
    })
    if (!ext) return jsonError('Primero extrae el ticket antes de confirmar.', 409)

    if (!ext.merchantName || ext.total === null || ext.total === undefined) {
      return jsonError('No se puede confirmar: falta proveedor o total en la extracción. Reintenta “Extraer”.', 400)
    }

    const now = new Date()
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.receiptExtraction.update({
        where: { id: ext.id },
        data: {
          confirmedAt: ext.confirmedAt ?? now,
          confirmedByUserId: userId,
        },
      })
      if (allocationId) {
        await tx.transaction.update({
          where: { id: receipt.transactionId },
          data: { allocationId },
        })
      }
      return u
    })

    return NextResponse.json(
      {
        ok: true,
        receiptId: receipt.id,
        transactionId: receipt.transactionId,
        message: 'Ticket confirmado. Listo para el siguiente.',
        extraction: mapExtractionForResponse(updated),
      },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo confirmar el ticket'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

