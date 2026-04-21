import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

/** GET: lista de tipos de partida personalizados de la familia */
export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const types = await prisma.familyEntityType.findMany({
      where: { familyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    return NextResponse.json({ ok: true, types })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

/** POST: crear tipo de partida personalizado (solo Admin) */
export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear tipos', 403)

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return jsonError('Nombre del tipo requerido', 400)

    const created = await prisma.familyEntityType.create({
      data: { familyId, name },
      select: { id: true, name: true },
    })
    return NextResponse.json({ ok: true, type: created }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return jsonError('Ya existe un tipo con ese nombre', 400)
    return jsonError(e?.message || 'No se pudo crear el tipo', 500)
  }
}
