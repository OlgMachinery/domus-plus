import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const REMINDER_INTERVAL_MS = 10 * 60 * 1000 // 10 min

/** Llamar desde un cron cada 10 min. Envía recordatorios por WhatsApp a emisor y admin por solicitudes PENDING sin respuesta. */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const cutoff = new Date(now.getTime() - REMINDER_INTERVAL_MS)

  const pending = await prisma.moneyRequest.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lte: cutoff },
      OR: [
        { lastReminderAt: null },
        { lastReminderAt: { lte: cutoff } },
      ],
    },
    select: {
      id: true,
      familyId: true,
      registrationCode: true,
      reason: true,
      amount: true,
      currency: true,
      createdByUserId: true,
      createdBy: { select: { name: true, email: true, phone: true } },
    },
  })

  let sent = 0
  for (const mr of pending) {
    const admin = await prisma.familyMember.findFirst({
      where: { familyId: mr.familyId, isFamilyAdmin: true },
      select: { user: { select: { phone: true, name: true } } },
    })
    const creatorPhone = mr.createdBy?.phone
    const adminPhone = admin?.user?.phone
    const code = mr.registrationCode ?? '—'
    const amountStr = Number(mr.amount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    const creatorName = mr.createdBy?.name || mr.createdBy?.email || 'Alguien'

    if (creatorPhone) {
      const msg = `Recordatorio: tu solicitud de efectivo *${code}* ($${amountStr} – ${mr.reason}) sigue pendiente. El admin la revisará en la app o por WhatsApp.`
      const res = await sendWhatsAppMessage(creatorPhone, msg)
      if (res.ok) sent++
    }
    if (adminPhone && adminPhone !== creatorPhone) {
      const msg = `Recordatorio: solicitud pendiente *${code}* de ${creatorName}: $${amountStr} – ${mr.reason}. Revisa en la app (Solicitudes) o responde al mensaje de la solicitud con el comprobante.`
      const res = await sendWhatsAppMessage(adminPhone, msg)
      if (res.ok) sent++
    }

    await prisma.moneyRequest.update({
      where: { id: mr.id },
      data: { lastReminderAt: now },
    })
  }

  return NextResponse.json({ ok: true, pending: pending.length, remindersSent: sent })
}
