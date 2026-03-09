import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** GET: listar sugerencias. Admin ve todas de la familia; usuario solo las suyas. */
export async function GET(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    const where: { familyId: string; userId?: string } = { familyId }
    if (!isFamilyAdmin) where.userId = userId

    const list = await prisma.budgetAdjustmentSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        userId: true,
        type: true,
        payload: true,
        status: true,
        resolvedAt: true,
        resolvedBy: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      ok: true,
      suggestions: list.map((s) => ({
        id: s.id,
        userId: s.userId,
        type: s.type,
        payload: (() => {
          try {
            return JSON.parse(s.payload) as Record<string, unknown>
          } catch {
            return {}
          }
        })(),
        status: s.status,
        resolvedAt: s.resolvedAt?.toISOString() ?? null,
        resolvedBy: s.resolvedBy ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
    })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

/** POST: crear sugerencia de ajuste (cualquier miembro). */
export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const body = await req.json().catch(() => ({}))
    const type = typeof body.type === 'string' ? body.type.trim() : ''
    const allowed = ['SUBDIVIDE_CATEGORY', 'CHANGE_LIMIT', 'NEW_CATEGORY', 'OTHER']
    if (!allowed.includes(type)) return jsonError('type debe ser uno de: ' + allowed.join(', '), 400)

    const payloadObj = typeof body.payload === 'object' && body.payload !== null ? body.payload : { text: String(body.text ?? '') }
    const payload = JSON.stringify(payloadObj)

    const created = await prisma.budgetAdjustmentSuggestion.create({
      data: { familyId, userId, type, payload, status: 'PENDING' },
      select: { id: true, type: true, status: true, createdAt: true },
    })

    return NextResponse.json(
      { ok: true, suggestion: { id: created.id, type: created.type, status: created.status, createdAt: created.createdAt.toISOString() } },
      { status: 201 }
    )
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la sugerencia', 500)
  }
}
