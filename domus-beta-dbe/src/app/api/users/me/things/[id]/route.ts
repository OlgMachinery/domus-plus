import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const THING_TYPES = ['DISPOSITIVO', 'AUTO', 'BICICLETA', 'SERVICIO_INTERNET', 'VISITA_MEDICA', 'OTRO'] as const

/** GET: una cosa con sus registros. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    const thing = await prisma.userThing.findFirst({
      where: { id, userId },
      include: { records: { orderBy: { date: 'desc' } } },
    })
    if (!thing) return jsonError('No encontrado', 404)
    return NextResponse.json({ ok: true, thing })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** PATCH: actualizar cosa. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}
    if (body.name != null) data.name = String(body.name).trim()
    if (body.type != null && THING_TYPES.includes(body.type)) data.type = body.type
    if (body.brand != null) data.brand = body.brand === '' ? null : String(body.brand).trim()
    if (body.model != null) data.model = body.model === '' ? null : String(body.model).trim()
    if (body.serialNumber != null) data.serialNumber = body.serialNumber === '' ? null : String(body.serialNumber).trim()
    if (body.acquisitionDate != null) data.acquisitionDate = body.acquisitionDate ? new Date(body.acquisitionDate) : null
    if (body.warrantyInfo != null) data.warrantyInfo = body.warrantyInfo === '' ? null : String(body.warrantyInfo).trim()
    if (body.serviceProviderContact != null) data.serviceProviderContact = body.serviceProviderContact === '' ? null : String(body.serviceProviderContact).trim()
    if (body.notes != null) data.notes = body.notes === '' ? null : String(body.notes).trim()
    if (body.invoiceUrl != null) data.invoiceUrl = body.invoiceUrl === '' ? null : String(body.invoiceUrl)
    if (body.extraJson !== undefined) data.extraJson = typeof body.extraJson === 'object' ? body.extraJson : null

    const updated = await prisma.userThing.update({
      where: { id },
      data,
      include: { records: true },
    })
    return NextResponse.json({ ok: true, thing: updated })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** DELETE: eliminar cosa (y sus registros por cascade). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)
    await prisma.userThing.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
