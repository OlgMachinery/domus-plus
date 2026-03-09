import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

/** PATCH: actualizar perfil del usuario actual (nombre, teléfono, ciudad). */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() || null : undefined
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : undefined
    const city = typeof body.city === 'string' ? body.city.trim() || null : undefined

    const data: { name?: string | null; phone?: string | null; city?: string | null } = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (city !== undefined) data.city = city

    if (Object.keys(data).length === 0) {
      return jsonError('Envía al menos un campo: name, phone o city', 400)
    }

    if (phone !== undefined && phone !== null && phone.length > 0 && phone.replace(/\D/g, '').length < 10) {
      return jsonError('El teléfono debe tener al menos 10 dígitos', 400)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, phone: true, city: true },
    })
    return NextResponse.json(user)
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'No se pudo actualizar el perfil', 500)
  }
}
