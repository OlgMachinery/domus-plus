/**
 * DELETE: eliminar un evento de calendario familiar (solo si pertenece a la familia del usuario).
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params
    if (!id) return jsonError('Falta id del evento', 400)

    const deleted = await prisma.familyCalendarEvent.deleteMany({
      where: { id, familyId },
    })

    if (deleted.count === 0) return jsonError('Evento no encontrado o sin permiso', 404)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al eliminar evento', 500)
  }
}
