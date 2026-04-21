import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const monthlyLimit = body.monthlyLimit !== undefined ? toPositiveNumber(body.monthlyLimit) : null
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined
    const defaultPaymentMethod =
      body.defaultPaymentMethod !== undefined
        ? typeof body.defaultPaymentMethod === 'string'
          ? body.defaultPaymentMethod.trim() || null
          : null
        : undefined
    const bankAccountLabel =
      body.bankAccountLabel !== undefined
        ? typeof body.bankAccountLabel === 'string'
          ? body.bankAccountLabel.trim().slice(0, 120) || null
          : null
        : undefined
    const providerClabe =
      body.providerClabe !== undefined
        ? typeof body.providerClabe === 'string'
          ? body.providerClabe.trim().replace(/\s/g, '').slice(0, 18) || null
          : null
        : undefined
    const providerReference =
      body.providerReference !== undefined
        ? typeof body.providerReference === 'string'
          ? body.providerReference.trim().slice(0, 120) || null
        : null
        : undefined

    if (body.monthlyLimit !== undefined && !monthlyLimit) return jsonError('Monto mensual inválido', 400)
    const hasUpdate =
      body.monthlyLimit !== undefined ||
      isActive !== undefined ||
      defaultPaymentMethod !== undefined ||
      bankAccountLabel !== undefined ||
      providerClabe !== undefined ||
      providerReference !== undefined
    if (!hasUpdate) return jsonError('Nada que actualizar', 400)

    const existing = await prisma.budgetAccount.findUnique({
      where: { id },
      select: { familyId: true, entityId: true },
    })
    if (!existing) return jsonError('Asignación no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta asignación', 403)

    if (!isFamilyAdmin) {
      const isOwner = await prisma.entityOwner.findUnique({
        where: { entityId_userId: { entityId: existing.entityId, userId } },
        select: { id: true },
      })
      if (!isOwner) return jsonError('Solo puedes editar montos de partidas que son tuyas', 403)
    }

    await prisma.budgetAccount.update({
      where: { id },
      data: {
        ...(body.monthlyLimit !== undefined ? { monthlyLimit: monthlyLimit!.toString() } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(defaultPaymentMethod !== undefined ? { defaultPaymentMethod } : {}),
        ...(bankAccountLabel !== undefined ? { bankAccountLabel } : {}),
        ...(providerClabe !== undefined ? { providerClabe } : {}),
        ...(providerReference !== undefined ? { providerReference } : {}),
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo actualizar la asignación'
    return jsonError(msg, 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const { id } = await params
    const existing = await prisma.budgetAccount.findUnique({
      where: { id },
      select: { familyId: true, entityId: true },
    })
    if (!existing) return jsonError('Asignación no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta asignación', 403)

    if (!isFamilyAdmin) {
      const isOwner = await prisma.entityOwner.findUnique({
        where: { entityId_userId: { entityId: existing.entityId, userId } },
        select: { id: true },
      })
      if (!isOwner) return jsonError('Solo puedes eliminar montos de partidas que son tuyas', 403)
    }

    await prisma.budgetAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo eliminar la asignación'
    return jsonError(msg, 500)
  }
}
