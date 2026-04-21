import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

/**
 * GET: catálogo + estado de asignación (casilla = cuenta presupuestal activa).
 * PATCH: activar/desactivar servicio en la entidad (sin crear servicios nuevos).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId } = await requireMembership(req)
    const { id: entityId } = await params

    const entity = await prisma.entity.findFirst({
      where: { id: entityId, familyId },
      select: { id: true },
    })
    if (!entity) return jsonError('Entidad no encontrada', 404)

    const [services, entityServices, budgetAccounts] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true },
        select: { id: true, name: true, categoryGroup: true },
        orderBy: [{ categoryGroup: 'asc' }, { name: 'asc' }],
      }),
      prisma.entityService.findMany({
        where: { entityId, familyId },
        select: { serviceId: true, isActive: true },
      }),
      prisma.budgetAccount.findMany({
        where: { entityId, familyId },
        select: { serviceId: true, isActive: true, id: true },
      }),
    ])

    const esBySvc = new Map(entityServices.map((r) => [r.serviceId, r.isActive]))
    const baBySvc = new Map(budgetAccounts.map((r) => [r.serviceId, r]))

    const items = services.map((s) => {
      const ba = baBySvc.get(s.id)
      /** Casilla ON = cuenta presupuestal existe y está activa */
      const enabled = !!ba?.isActive
      return {
        serviceId: s.id,
        name: s.name,
        categoryGroup: s.categoryGroup,
        enabled,
        entityServiceActive: esBySvc.get(s.id) ?? false,
        budgetAccountId: ba?.id ?? null,
        budgetAccountActive: ba?.isActive ?? false,
      }
    })

    return NextResponse.json({ ok: true, items }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autenticado'
    return jsonError(msg, 401)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede asignar servicios', 403)

    const { id: entityId } = await params
    const body = await req.json().catch(() => ({}))
    const serviceId = typeof body.serviceId === 'string' ? body.serviceId.trim() : ''
    const enabled = body.enabled === true

    if (!serviceId) return jsonError('serviceId requerido', 400)

    const entity = await prisma.entity.findFirst({
      where: { id: entityId, familyId },
      select: { id: true },
    })
    if (!entity) return jsonError('Entidad no encontrada', 404)

    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: { id: true },
    })
    if (!service) return jsonError('Servicio no encontrado o inactivo', 404)

    await prisma.$transaction(async (tx) => {
      if (enabled) {
        await tx.entityService.upsert({
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
        await tx.budgetAccount.upsert({
          where: {
            entityId_serviceId: { entityId, serviceId },
          },
          create: {
            familyId,
            entityId,
            serviceId,
            monthlyLimit: 0,
            isActive: true,
          },
          update: { isActive: true },
        })
      } else {
        await tx.budgetAccount.updateMany({
          where: { familyId, entityId, serviceId },
          data: { isActive: false },
        })
      }
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo actualizar'
    return jsonError(msg, 500)
  }
}
