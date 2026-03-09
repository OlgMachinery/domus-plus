import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { jsonError } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

    if (!token) return jsonError('Token requerido', 400)
    if (!newPassword || newPassword.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres', 400)

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    })
    if (!record) return jsonError('Enlace inválido o ya usado', 400)
    if (new Date(record.expiresAt) < new Date()) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {})
      return jsonError('Este enlace ha caducado. Solicita uno nuevo.', 410)
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ])

    return NextResponse.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al restablecer contraseña', 500)
  }
}
