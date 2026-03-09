import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** PATCH: resolver sugerencia (solo admin). status: APPROVED | REJECTED */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede resolver sugerencias', 403)

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const status = body.status === 'APPROVED' || body.status === 'REJECTED' ? body.status : null
    if (!status) return jsonError('status debe ser APPROVED o REJECTED', 400)

    const suggestion = await prisma.budgetAdjustmentSuggestion.findFirst({
      where: { id, familyId },
      select: { id: true, status: true },
    })
    if (!suggestion) return jsonError('Sugerencia no encontrada', 404)
    if (suggestion.status !== 'PENDING') return jsonError('La sugerencia ya fue resuelta', 400)

    await prisma.budgetAdjustmentSuggestion.update({
      where: { id },
      data: { status, resolvedAt: new Date(), resolvedBy: userId },
    })

    return NextResponse.json({ ok: true, status })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo actualizar', 500)
  }
}
