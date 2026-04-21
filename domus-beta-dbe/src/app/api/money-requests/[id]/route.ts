import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { mapBudgetAccountToLegacyAllocationShape } from '@/lib/budget/transaction-allocation-compat'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params
    const r = await prisma.moneyRequest.findFirst({
      where: { id, familyId },
      select: {
        id: true,
        familyId: true,
        createdByUserId: true,
        requestedAt: true,
        forEntityId: true,
        forName: true,
        budgetAccountId: true,
        date: true,
        reason: true,
        amount: true,
        currency: true,
        status: true,
        transactionId: true,
        registrationCode: true,
        outboundMessageSid: true,
        approvedAt: true,
        approvedByUserId: true,
        rejectedAt: true,
        rejectedByUserId: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        forEntity: { select: { id: true, name: true, type: true } },
        budgetAccount: {
          select: {
            id: true,
            entity: { select: { id: true, name: true, type: true } },
            service: { select: { id: true, name: true } },
          },
        },
        transaction: { select: { id: true, amount: true, date: true, registrationCode: true } },
      },
    })
    if (!r) return jsonError('Solicitud no encontrada', 404)

    const alloc =
      r.budgetAccount?.entity && r.budgetAccount?.service
        ? mapBudgetAccountToLegacyAllocationShape({
            id: r.budgetAccount.id,
            entity: r.budgetAccount.entity,
            service: r.budgetAccount.service,
          })
        : null

    return NextResponse.json({
      ok: true,
      moneyRequest: {
        ...r,
        allocationId: r.budgetAccountId,
        requestedAt: r.requestedAt.toISOString(),
        date: r.date.toISOString(),
        amount: r.amount.toString(),
        approvedAt: r.approvedAt?.toISOString() ?? null,
        rejectedAt: r.rejectedAt?.toISOString() ?? null,
        deliveredAt: r.deliveredAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        allocation: alloc,
        transaction: r.transaction
          ? {
              ...r.transaction,
              amount: r.transaction.amount.toString(),
              date: r.transaction.date.toISOString(),
            }
          : null,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'No autenticado' || msg === 'No hay familia activa') return jsonError(msg, 401)
    return jsonError(msg || 'Error', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede aprobar o rechazar', 403)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : ''

    const existing = await prisma.moneyRequest.findFirst({
      where: { id, familyId },
      select: { id: true, status: true },
    })
    if (!existing) return jsonError('Solicitud no encontrada', 404)
    if (existing.status !== 'PENDING') return jsonError('La solicitud ya fue procesada', 400)

    const now = new Date()
    if (action === 'APPROVE') {
      await prisma.moneyRequest.update({
        where: { id },
        data: { status: 'APPROVED', approvedAt: now, approvedByUserId: userId, rejectedAt: null, rejectedByUserId: null },
      })
      return NextResponse.json({ ok: true, status: 'APPROVED' })
    }
    if (action === 'REJECT') {
      await prisma.moneyRequest.update({
        where: { id },
        data: { status: 'REJECTED', rejectedAt: now, rejectedByUserId: userId, approvedAt: null, approvedByUserId: null },
      })
      return NextResponse.json({ ok: true, status: 'REJECTED' })
    }
    return jsonError('Indica action: "approve" o "reject"', 400)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'No autenticado' || msg === 'No hay familia activa') return jsonError(msg, 401)
    return jsonError(msg || 'Error', 500)
  }
}
