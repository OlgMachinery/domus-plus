import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { seedEntitiesTreePreview } from '@/lib/budget/seed-entities-tree-preview'

export const dynamic = 'force-dynamic'

/**
 * POST: árbol demo bajo «Familia» (prefijo DOMUS-demo ·) + servicios con límite 0.
 * Solo admin. Idempotente por nombre de entidad.
 */
export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede cargar la vista previa', 403)

    const member = await prisma.familyMember.findFirst({
      where: { familyId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    })
    if (!member) return jsonError('La familia no tiene integrantes', 400)

    const stats = await prisma.$transaction(async (tx) => seedEntitiesTreePreview(tx, familyId, member.userId))

    return NextResponse.json({ ok: true, ...stats, hint: 'Recarga /setup/entities. Para quitar: borra entidades cuyo nombre empiece por «DOMUS-demo ·».' }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return jsonError(msg, 500)
  }
}
