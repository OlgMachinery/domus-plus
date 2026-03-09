import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { jsonError, setSessionCookie } from '@/lib/auth/session'
import { signToken } from '@/lib/auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const requestedFamilyId = typeof body.familyId === 'string' ? body.familyId : null

    if (!email || !password) return jsonError('Email y contraseña son requeridos', 400)

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, name: true },
    })
    if (!user) return jsonError('Credenciales inválidas', 400)

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return jsonError('Credenciales inválidas', 400)

    const memberships = await prisma.familyMember.findMany({
      where: { userId: user.id },
      select: { familyId: true },
      orderBy: { createdAt: 'desc' },
    })

    let activeFamilyId: string | null = memberships[0]?.familyId ?? null
    if (requestedFamilyId && memberships.some((m) => m.familyId === requestedFamilyId)) {
      activeFamilyId = requestedFamilyId
    }

    const token = await signToken({ userId: user.id, familyId: activeFamilyId })
    const res = NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name }, familyId: activeFamilyId, token },
      { status: 200 }
    )
    setSessionCookie(req, res, token)
    return res
  } catch (err) {
    console.error('[auth/login] Error:', err)
    return jsonError('No se pudo iniciar sesión. Revisa que la base de datos esté accesible.', 500)
  }
}

