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
      orderBy: [{ budgetAccountId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        budgetAccountId: true,
        name: true,
        sortOrder: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      subdivisions: list.map((s) => ({
        id: s.id,
        budgetAccountId: s.budgetAccountId,
        allocationId: s.budgetAccountId,
        name: s.name,
        sortOrder: s.sortOrder,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autenticado'
    return jsonError(msg, 401)
  }
}

/** POST: crear subdivisión personal. budgetAccountId = cuenta donde el usuario es dueño de entidad. */
export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const body = await req.json().catch(() => ({}))
    const budgetAccountId =
      (typeof body.budgetAccountId === 'string' ? body.budgetAccountId.trim() : '') ||
      (typeof body.allocationId === 'string' ? body.allocationId.trim() : '')
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!budgetAccountId || !name) return jsonError('budgetAccountId (o allocationId) y name son requeridos', 400)
    if (name.length > 80) return jsonError('Nombre muy largo', 400)

    const allocation = await prisma.budgetAccount.findFirst({
      where: { id: budgetAccountId, familyId },
      select: { id: true, entityId: true },
    })
    if (!allocation) return jsonError('Cuenta presupuestal no encontrada', 404)

    const isOwner = await prisma.entityOwner.findUnique({
      where: { entityId_userId: { entityId: allocation.entityId, userId } },
      select: { userId: true },
    })
    if (!isOwner) return jsonError('Solo puedes crear subdivisiones en tus propias partidas', 403)

    const created = await prisma.userBudgetSubdivision.create({
      data: {
        userId,
        familyId,
        budgetAccountId,
        name,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      },
      select: { id: true, budgetAccountId: true, name: true, sortOrder: true, createdAt: true },
    })

    return NextResponse.json(
      {
        ok: true,
        subdivision: {
          id: created.id,
          budgetAccountId: created.budgetAccountId,
          allocationId: created.budgetAccountId,
          name: created.name,
          sortOrder: created.sortOrder,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err?.code === 'P2002') return jsonError('Ya existe una subdivisión con ese nombre en esa partida', 400)
    return jsonError(err?.message || 'No se pudo crear', 500)
  }
}
