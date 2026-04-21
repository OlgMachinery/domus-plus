import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'
import { getOrCreateBudgetAccount } from '@/lib/budget/get-or-create-budget-account'
import { getOrCreateServiceFromBudgetCategoryName } from '@/lib/budget/legacy-category-to-service'

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
      const owned = await prisma.entityOwner.findMany({
        where: { familyId, userId },
        select: { entityId: true },
      })
      const entityIds = [...new Set(owned.map((o: { entityId: string }) => o.entityId))]
      if (entityIds.length === 0) {
        return NextResponse.json({ ok: true, allocations: [] }, { status: 200 })
      }
      where.entityId = { in: entityIds }
    }
    const rows = await prisma.budgetAccount.findMany({
      where,
      select: {
        id: true,
        entityId: true,
        serviceId: true,
        monthlyLimit: true,
        isActive: true,
        defaultPaymentMethod: true,
        bankAccountLabel: true,
        providerClabe: true,
        providerReference: true,
        entity: { select: { id: true, name: true, type: true, customType: { select: { id: true, name: true } } } },
        service: { select: { id: true, name: true, categoryGroup: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      {
        ok: true,
        allocations: rows.map((a) => ({
          id: a.id,
          entity: a.entity,
          /** Compat UI: antes "category" = destino; ahora es servicio del catálogo */
          category: {
            id: a.service.id,
            name: a.service.name,
            type: 'SERVICE',
          },
          service: a.service,
          monthlyLimit: a.monthlyLimit.toString(),
          isActive: a.isActive,
          defaultPaymentMethod: a.defaultPaymentMethod ?? null,
          bankAccountLabel: a.bankAccountLabel ?? null,
          providerClabe: a.providerClabe ?? null,
          providerReference: a.providerReference ?? null,
        })),
      },
      { status: 200 }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autenticado'
    return jsonError(msg, 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const body = await req.json().catch(() => ({}))
    const entityId = typeof body.entityId === 'string' ? body.entityId : ''
    const serviceIdRaw = typeof body.serviceId === 'string' ? body.serviceId : ''
    const categoryId = typeof body.categoryId === 'string' ? body.categoryId : ''
    const monthlyLimit = toPositiveNumber(body.monthlyLimit)

    if (!entityId) return jsonError('Entidad requerida', 400)
    if (!monthlyLimit) return jsonError('Monto mensual inválido', 400)

    const entity = await prisma.entity.findUnique({ where: { id: entityId }, select: { familyId: true } })
    if (!entity) return jsonError('Entidad no encontrada', 404)
    if (entity.familyId !== familyId) return jsonError('No tienes acceso a esa entidad', 403)

    if (!isFamilyAdmin) {
      const isOwner = await prisma.entityOwner.findUnique({
        where: { entityId_userId: { entityId, userId } },
        select: { id: true },
      })
      if (!isOwner)
        return jsonError('Solo puedes crear montos para partidas que son tuyas (o pide al Admin que te asigne una)', 403)
    }

    let serviceId = serviceIdRaw
    if (!serviceId && categoryId) {
      const category = await prisma.budgetCategory.findUnique({ where: { id: categoryId }, select: { familyId: true, name: true } })
      if (!category) return jsonError('Categoría no encontrada', 404)
      if (category.familyId !== familyId) return jsonError('No tienes acceso a esa categoría', 403)
      const svc = await getOrCreateServiceFromBudgetCategoryName(prisma, category.name)
      serviceId = svc.id
    }

    if (!serviceId) return jsonError('Debes indicar serviceId o categoryId (legado)', 400)

    await prisma.entityService.upsert({
      where: {
        entityId_serviceId: { entityId, serviceId },
      },
      create: {
        familyId,
        entityId,
        serviceId,
        isActive: true,
      },
      update: { isActive: true },
    })

    const defaultPaymentMethod = typeof body.defaultPaymentMethod === 'string' ? body.defaultPaymentMethod.trim() || null : null
    const bankAccountLabel = typeof body.bankAccountLabel === 'string' ? body.bankAccountLabel.trim().slice(0, 120) || null : null
    const providerClabe = typeof body.providerClabe === 'string' ? body.providerClabe.trim().replace(/\s/g, '').slice(0, 18) || null : null
    const providerReference = typeof body.providerReference === 'string' ? body.providerReference.trim().slice(0, 120) || null : null

    const account = await getOrCreateBudgetAccount(familyId, entityId, serviceId, prisma)
    const updated = await prisma.budgetAccount.update({
      where: { id: account.id },
      data: {
        monthlyLimit: monthlyLimit.toString(),
        isActive: body.isActive !== false,
        defaultPaymentMethod,
        bankAccountLabel,
        providerClabe,
        providerReference,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, id: updated.id }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo crear la asignación'
    return jsonError(msg, 500)
  }
}
