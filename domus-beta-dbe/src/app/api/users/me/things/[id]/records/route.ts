import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** GET: listar registros de mantenimiento de la cosa. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)
    const records = await prisma.userThingMaintenanceRecord.findMany({
      where: { userThingId: id },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json({ ok: true, records })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** POST: crear registro. Body: recordType, date, nextDueDate?, amount?, description?, imageUrl? */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)

    const body = await req.json().catch(() => ({}))
    const recordType = (body.recordType as string)?.trim() || 'MANTENIMIENTO'
    const date = body.date ? new Date(body.date) : new Date()
    const nextDueDate = body.nextDueDate ? new Date(body.nextDueDate) : undefined
    const amount = body.amount != null ? String(body.amount) : undefined
    const description = (body.description as string)?.trim() || undefined
    const imageUrl = (body.imageUrl as string)?.trim() || undefined

    const record = await prisma.userThingMaintenanceRecord.create({
      data: {
        userThingId: id,
        recordType,
        date,
        nextDueDate: nextDueDate || undefined,
        amount: amount || undefined,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
      },
    })
    return NextResponse.json({ ok: true, record }, { status: 201 })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
