import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { jsonError } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim()
    if (!code) return jsonError('Falta el código de invitación', 400)

    const invite = await prisma.familyInvite.findUnique({
      where: { code },
      select: { id: true, familyId: true, expiresAt: true, family: { select: { name: true } } },
    })
    if (!invite) return jsonError('Código de invitación no válido', 404)
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return jsonError('Este enlace de invitación ha caducado', 410)
    }

    return NextResponse.json({
      ok: true,
      familyName: invite.family.name,
      code: code,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al validar', 500)
  }
}
