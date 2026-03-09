import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** GET: listar subdivisiones personales del usuario (solo las suyas). */
export async function GET(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)

    const list = await prisma.userBudgetSubdivision.findMany({
      where: { userId, familyId },
      orderBy: [{ allocationId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        allocationId: true,
        name: true,
        sortOrder: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      subdivisions: list.map((s) => ({
        id: s.id,
        allocationId: s.allocationId,
        name: s.name,
        sortOrder: s.sortOrder,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

/** POST: crear subdivisión personal. allocationId debe ser de una partida donde el usuario es dueño. */
export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const body = await req.json().catch(() => ({}))
    const allocationId = typeof body.allocationId === 'string' ? body.allocationId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!allocationId || !name) return jsonError('allocationId y name son requeridos', 400)
    if (name.length > 80) return jsonError('Nombre muy largo', 400)

    const allocation = await prisma.entityBudgetAllocation.findFirst({
      where: { id: allocationId, familyId },
      select: { id: true, entityId: true },
    })
    if (!allocation) return jsonError('Asignación no encontrada', 404)

    const isOwner = await prisma.budgetEntityOwner.findUnique({
      where: { entityId_userId: { entityId: allocation.entityId, userId } },
      select: { userId: true },
    })
    if (!isOwner) return jsonError('Solo puedes crear subdivisiones en tus propias partidas', 403)

    const created = await prisma.userBudgetSubdivision.create({
      data: {
        userId,
        familyId,
        allocationId,
        name,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      },
      select: { id: true, allocationId: true, name: true, sortOrder: true, createdAt: true },
    })

    return NextResponse.json(
      {
        ok: true,
        subdivision: {
          id: created.id,
          allocationId: created.allocationId,
          name: created.name,
          sortOrder: created.sortOrder,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e: any) {
    if (e?.code === 'P2002') return jsonError('Ya existe una subdivisión con ese nombre en esa partida', 400)
    return jsonError(e?.message || 'No se pudo crear', 500)
  }
}
