import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** PATCH: actualizar registro. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id, recordId } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)
    const record = await prisma.userThingMaintenanceRecord.findFirst({
      where: { id: recordId, userThingId: id },
    })
    if (!record) return jsonError('Registro no encontrado', 404)

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (body.recordType != null) data.recordType = String(body.recordType)
    if (body.date != null) data.date = new Date(body.date)
    if (body.nextDueDate !== undefined) data.nextDueDate = body.nextDueDate ? new Date(body.nextDueDate) : null
    if (body.amount !== undefined) data.amount = body.amount === '' ? null : String(body.amount)
    if (body.description !== undefined) data.description = body.description === '' ? null : body.description
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl === '' ? null : body.imageUrl

    const updated = await prisma.userThingMaintenanceRecord.update({
      where: { id: recordId },
      data,
    })
    return NextResponse.json({ ok: true, record: updated })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** DELETE: eliminar registro. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id, recordId } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)
    const record = await prisma.userThingMaintenanceRecord.findFirst({
      where: { id: recordId, userThingId: id },
    })
    if (!record) return jsonError('Registro no encontrado', 404)
    await prisma.userThingMaintenanceRecord.delete({ where: { id: recordId } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
