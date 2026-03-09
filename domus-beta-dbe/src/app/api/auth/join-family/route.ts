import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { setSessionCookie, jsonError } from '@/lib/auth/session'
import { signToken } from '@/lib/auth/jwt'

function normalizeEmail(v: unknown) {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() || null : null
    const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null
    const city = typeof body.city === 'string' ? body.city.trim() || null : null

    if (!code) return jsonError('Código de invitación requerido', 400)
    if (!email || !email.includes('@')) return jsonError('Email requerido', 400)
    if (!password || password.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres', 400)
    if (!phone || phone.replace(/\D/g, '').length < 10) return jsonError('Teléfono requerido (mínimo 10 dígitos)', 400)

    const invite = await prisma.familyInvite.findUnique({
      where: { code },
      select: { id: true, familyId: true, expiresAt: true, family: { select: { name: true } } },
    })
    if (!invite) return jsonError('Código de invitación no válido', 404)
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return jsonError('Este enlace de invitación ha caducado', 410)
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    let userId: string
    if (existingUser) {
      userId = existingUser.id
      const alreadyMember = await prisma.familyMember.findUnique({
        where: { familyId_userId: { familyId: invite.familyId, userId: existingUser.id } },
      })
      if (alreadyMember) return jsonError('Ya perteneces a esta familia', 400)
    } else {
      const passwordHash = await hashPassword(password)
      const created = await prisma.user.create({
        data: { email, passwordHash, name, phone, city },
        select: { id: true },
      })
      userId = created.id
    }

    await prisma.familyMember.create({
      data: {
        familyId: invite.familyId,
        userId,
        isFamilyAdmin: false,
      },
    })

    const token = await signToken({ userId, familyId: invite.familyId })
    const res = NextResponse.json(
      { ok: true, familyName: invite.family.name },
      { status: 201 }
    )
    setSessionCookie(req, res, token)
    return res
  } catch (e: any) {
    if (e?.code === 'P2002') return jsonError('Ya perteneces a esta familia o el email está en uso', 400)
    return jsonError(e?.message || 'No se pudo unir a la familia', 500)
  }
}
