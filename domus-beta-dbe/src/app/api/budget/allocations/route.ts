import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export async function GET(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural
    const mine = req.nextUrl.searchParams.get('mine') === '1'
    const where: { familyId: string; entityId?: { in: string[] } } = { familyId }
    if (mine) {
      const owned = await prisma.budgetEntityOwner.findMany({
        where: { familyId, userId },
        select: { entityId: true },
      })
      const entityIds = [...new Set(owned.map((o) => o.entityId))]
      if (entityIds.length === 0) {
        return NextResponse.json({ ok: true, allocations: [] }, { status: 200 })
      }
      where.entityId = { in: entityIds }
    }
    const allocations = await prisma.entityBudgetAllocation.findMany({
      where,
      select: {
        id: true,
        entityId: true,
        categoryId: true,
        monthlyLimit: true,
        isActive: true,
        entity: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      {
        ok: true,
        allocations: allocations.map((a) => ({
          id: a.id,
          entity: a.entity,
          category: a.category,
          monthlyLimit: a.monthlyLimit.toString(),
          isActive: a.isActive,
        })),
      },
      { status: 200 }
    )
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede asignar montos', 403)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const body = await req.json().catch(() => ({}))
    const entityId = typeof body.entityId === 'string' ? body.entityId : ''
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''
    const monthlyLimit = toPositiveNumber(body.monthlyLimit)

    if (!entityId || !categoryId) return jsonError('Entidad y categoría son requeridas', 400)
    if (!monthlyLimit) return jsonError('Monto mensual inválido', 400)

    const entity = await prisma.budgetEntity.findUnique({ where: { id: entityId }, select: { familyId: true } })
    if (!entity) return jsonError('Entidad no encontrada', 404)
    if (entity.familyId !== familyId) return jsonError('No tienes acceso a esa entidad', 403)

    const category = await prisma.budgetCategory.findUnique({ where: { id: categoryId }, select: { familyId: true } })
    if (!category) return jsonError('Categoría no encontrada', 404)
    if (category.familyId !== familyId) return jsonError('No tienes acceso a esa categoría', 403)

    const created = await prisma.entityBudgetAllocation.create({
      data: {
        familyId,
        entityId,
        categoryId,
        monthlyLimit: monthlyLimit.toString(),
        isActive: body.isActive !== false,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la asignación', 500)
  }
}

