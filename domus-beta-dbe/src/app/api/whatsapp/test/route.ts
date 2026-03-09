import { NextRequest, NextResponse } from 'next/server'
import { requireMembership, jsonError } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

/**
 * POST /api/whatsapp/test
 * Envía un mensaje de prueba por WhatsApp al usuario indicado.
 * Solo se puede enviar al propio usuario (userId debe ser el de la sesión).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: sessionUserId } = await requireMembership(req)
    const body = await req.json().catch(() => ({}))
    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : sessionUserId
    if (targetUserId !== sessionUserId) return jsonError('Solo puedes enviar prueba a tu propio número', 403)

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { phone: true, name: true },
    })
    if (!user?.phone || user.phone.replace(/\D/g, '').length < 10) {
      return jsonError('Guarda un teléfono con al menos 10 dígitos en tu perfil (Usuarios) y vuelve a intentar.', 400)
    }

    const result = await sendWhatsAppMessage(
      user.phone,
      `DOMUS prueba: Hola${user.name ? ` ${user.name}` : ''}, si recibes esto Twilio está configurado correctamente.`
    )
    if (!result.ok) {
      return jsonError(result.error || 'No se pudo enviar (revisa TWILIO_* en el servidor)', 500)
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    if (e?.message === 'No autenticado' || e?.message === 'No hay familia activa') {
      return jsonError(e.message, 401)
    }
    return jsonError(e?.message || 'Error al enviar prueba', 500)
  }
}
