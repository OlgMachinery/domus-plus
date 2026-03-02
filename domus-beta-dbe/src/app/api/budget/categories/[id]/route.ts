import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede editar categorías', 403)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const type = typeof body.type === 'string' ? body.type.trim() : undefined
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined

    if (name === undefined && type === undefined && isActive === undefined) return jsonError('Nada que actualizar', 400)

    const existing = await prisma.budgetCategory.findUnique({
      where: { id },
      select: { familyId: true },
    })
    if (!existing) return jsonError('Categoría no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta categoría', 403)

    const updated = await prisma.budgetCategory.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: { id: true, type: true, name: true, isActive: true },
    })

    return NextResponse.json({ ok: true, category: updated }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo actualizar la categoría', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede eliminar categorías', 403)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const { id } = await params
    const existing = await prisma.budgetCategory.findUnique({
      where: { id },
      select: { familyId: true },
    })
    if (!existing) return jsonError('Categoría no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta categoría', 403)

    await prisma.budgetCategory.delete({ where: { id } })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo eliminar la categoría', 500)
  }
}

