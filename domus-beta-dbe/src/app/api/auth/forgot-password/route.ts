import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { jsonError } from '@/lib/auth/session'
import { sendEmail } from '@/lib/email'
import { DOMUS_APP_URL } from '@/lib/whatsapp'
import crypto from 'crypto'

function normalizeEmail(v: unknown) {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    if (!email || !email.includes('@')) return jsonError('Email requerido', 400)

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    // Siempre devolver 200 para no revelar si el email existe
    if (!user) {
      return NextResponse.json({ ok: true, message: 'Si el correo existe, recibirás un enlace para restablecer la contraseña.' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    const resetUrl = `${DOMUS_APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
    const text = `Restablece tu contraseña de DOMUS en: ${resetUrl}\n\nEl enlace caduca en 24 horas.\n\nD+ ${DOMUS_APP_URL}`
    await sendEmail({
      to: user.email,
      subject: 'Restablecer contraseña - DOMUS',
      text,
      html: `<p>Restablece tu contraseña en: <a href="${resetUrl}">${resetUrl}</a></p><p>El enlace caduca en 24 horas.</p><p>D+ ${DOMUS_APP_URL}</p>`,
    })

    return NextResponse.json({ ok: true, message: 'Si el correo existe, recibirás un enlace para restablecer la contraseña.' })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al procesar', 500)
  }
}
