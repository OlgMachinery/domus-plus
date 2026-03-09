import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** DELETE: eliminar subdivisión personal (solo las propias). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params

    const sub = await prisma.userBudgetSubdivision.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!sub) return jsonError('Subdivisión no encontrada o no te pertenece', 404)

    await prisma.userBudgetSubdivision.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo eliminar', 500)
  }
}
