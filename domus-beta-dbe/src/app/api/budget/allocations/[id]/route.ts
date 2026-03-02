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
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede editar asignaciones', 403)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const monthlyLimit = body.monthlyLimit !== undefined ? toPositiveNumber(body.monthlyLimit) : null
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined

    if (body.monthlyLimit !== undefined && !monthlyLimit) return jsonError('Monto mensual inválido', 400)
    if (body.monthlyLimit === undefined && isActive === undefined) return jsonError('Nada que actualizar', 400)

    const existing = await prisma.entityBudgetAllocation.findUnique({
      where: { id },
      select: { familyId: true },
    })
    if (!existing) return jsonError('Asignación no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta asignación', 403)

    await prisma.entityBudgetAllocation.update({
      where: { id },
      data: {
        ...(body.monthlyLimit !== undefined ? { monthlyLimit: monthlyLimit!.toString() } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo actualizar la asignación', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede eliminar asignaciones', 403)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const { id } = await params
    const existing = await prisma.entityBudgetAllocation.findUnique({
      where: { id },
      select: { familyId: true },
    })
    if (!existing) return jsonError('Asignación no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta asignación', 403)

    await prisma.entityBudgetAllocation.delete({ where: { id } })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo eliminar la asignación', 500)
  }
}

