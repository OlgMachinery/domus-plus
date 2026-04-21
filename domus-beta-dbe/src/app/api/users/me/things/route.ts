import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const THING_TYPES = ['DISPOSITIVO', 'AUTO', 'BICICLETA', 'SERVICIO_INTERNET', 'VISITA_MEDICA', 'OTRO'] as const

/** GET: listar cosas del usuario (con registros de mantenimiento). */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const type = req.nextUrl.searchParams.get('type')
    const where: { userId: string; type?: string } = { userId }
    if (type && THING_TYPES.includes(type as any)) where.type = type

    const things = await prisma.userThing.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        records: { orderBy: { date: 'desc' } },
      },
    })
    return NextResponse.json({ ok: true, things })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** POST: crear una cosa. Body: type, name, brand?, model?, serialNumber?, acquisitionDate?, warrantyInfo?, serviceProviderContact?, notes?, extraJson? */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const type = (body.type as string)?.trim()
    const name = (body.name as string)?.trim()
    if (!type || !name) return jsonError('Faltan type y name', 400)
    if (!THING_TYPES.includes(type as any)) return jsonError('type debe ser: DISPOSITIVO, AUTO, BICICLETA, SERVICIO_INTERNET, VISITA_MEDICA, OTRO', 400)

    const acquisitionDate = body.acquisitionDate ? new Date(body.acquisitionDate) : undefined
    const extraJson = typeof body.extraJson === 'object' && body.extraJson !== null ? body.extraJson : undefined

    const thing = await prisma.userThing.create({
      data: {
        userId,
        type,
        name,
        brand: (body.brand as string)?.trim() || undefined,
        model: (body.model as string)?.trim() || undefined,
        serialNumber: (body.serialNumber as string)?.trim() || undefined,
        acquisitionDate: acquisitionDate || undefined,
        warrantyInfo: (body.warrantyInfo as string)?.trim() || undefined,
        serviceProviderContact: (body.serviceProviderContact as string)?.trim() || undefined,
        notes: (body.notes as string)?.trim() || undefined,
        extraJson: extraJson || undefined,
      },
      include: { records: true },
    })
    return NextResponse.json({ ok: true, thing }, { status: 201 })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
