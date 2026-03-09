import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { generateInviteCode } from '@/lib/invite-code'
import { DOMUS_APP_URL } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede ver invitaciones', 403)

    const invites = await prisma.familyInvite.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, code: true, expiresAt: true, createdAt: true },
    })

    return NextResponse.json({ ok: true, invites }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear invitaciones', 403)

    const body = await req.json().catch(() => ({}))
    const expiresInDays = typeof body.expiresInDays === 'number' ? Math.min(30, Math.max(1, body.expiresInDays)) : 7

    let code = generateInviteCode(8)
    for (let i = 0; i < 5; i++) {
      const existing = await prisma.familyInvite.findUnique({ where: { code } })
      if (!existing) break
      code = generateInviteCode(8)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    await prisma.familyInvite.create({
      data: {
        familyId,
        code,
        expiresAt,
        createdByUserId: userId,
      },
    })

    const joinUrl = `${DOMUS_APP_URL.replace(/\/$/, '')}/join?code=${encodeURIComponent(code)}`

    return NextResponse.json(
      { ok: true, code, expiresAt: expiresAt.toISOString(), joinUrl },
      { status: 201 }
    )
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la invitación', 500)
  }
}
