import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { sendWhatsAppMessage, getDomusLinkSuffix, normalizePhoneForStorage } from '@/lib/whatsapp'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)

    const members = await prisma.familyMember.findMany({
      where: { familyId },
      select: {
        isFamilyAdmin: true,
        user: { select: { id: true, email: true, name: true, phone: true, city: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      {
        ok: true,
        members: members.map((m) => ({
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          phone: m.user.phone,
          city: m.user.city,
          avatarUrl: m.user.avatarUrl ?? null,
          isFamilyAdmin: m.isFamilyAdmin,
        })),
      },
      { status: 200 }
    )
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin: requesterIsAdmin } = await requireMembership(req)
    if (!requesterIsAdmin) return jsonError('Solo el administrador puede agregar integrantes', 403)

    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() : null
    const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : null
    const phone = phoneRaw
      ? (normalizePhoneForStorage(phoneRaw).replace(/\D/g, '').length >= 12 ? normalizePhoneForStorage(phoneRaw) : phoneRaw)
      : null
    const makeAdmin = body.isFamilyAdmin === true

    if (!email || !email.includes('@')) return jsonError('Email inválido', 400)

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } })

    let userId = user?.id
    if (!userId) {
      if (!password || password.length < 6) {
        return jsonError('Para crear el usuario nuevo, la contraseña debe tener al menos 6 caracteres', 400)
      }
      const passwordHash = await hashPassword(password)
      const created = await prisma.user.create({
        data: { email, passwordHash, name, phone },
        select: { id: true, email: true, name: true },
      })
      userId = created.id
    }

    // Crear membership (si ya existe, no falla)
    try {
      await prisma.familyMember.create({
        data: { familyId, userId, isFamilyAdmin: makeAdmin },
      })
    } catch (e: any) {
      // Ya existe en la familia
      if (e?.code !== 'P2002') throw e
    }

    // Notificar al invitado por WhatsApp si tiene teléfono
    const addedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, name: true, email: true },
    })
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { name: true },
    })
    const phoneToNotify = addedUser?.phone || phone
    if (phoneToNotify && family?.name) {
      const displayName = addedUser?.name || addedUser?.email || 'Alguien'
      const msg = `Te agregaron a la familia *${family.name}* en DOMUS. Entra con tu correo y contraseña.${getDomusLinkSuffix()}`
      await sendWhatsAppMessage(phoneToNotify, msg).catch(() => {})
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return jsonError('Ese integrante ya está en la familia', 400)
    return jsonError(e?.message || 'No se pudo agregar el integrante', 500)
  }
}

