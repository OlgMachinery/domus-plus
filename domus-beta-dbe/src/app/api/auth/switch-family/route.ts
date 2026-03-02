import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth, setSessionCookie } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const familyId = typeof body.familyId === 'string' ? body.familyId : ''
    if (!familyId) return jsonError('familyId es requerido', 400)

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
      select: { familyId: true },
    })
    if (!membership) return jsonError('No tienes acceso a esta familia', 403)

    const token = await signToken({ userId, familyId })
    const res = NextResponse.json({ ok: true, familyId }, { status: 200 })
    setSessionCookie(req, res, token)
    return res
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

