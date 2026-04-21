/**
 * Cron: recordatorios por WhatsApp por documentos por vencer.
 * - Primera vez: 6 meses antes del vencimiento (o en cualquier momento si ya está dentro de 6 meses).
 * - Luego: cada semana hasta que el usuario suba uno nuevo (mismo category reemplaza el flujo).
 * Requiere CRON_SECRET. Llamar desde cron cada día (ej. 9:00).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const sixMonthsFromNow = new Date(now.getTime() + SIX_MONTHS_MS)
  const oneWeekAgo = new Date(now.getTime() - ONE_WEEK_MS)

  // Documentos con vencimiento en los próximos 6 meses (o ya vencidos)
  const docs = await prisma.userDocument.findMany({
    where: {
      expiresAt: { not: null, lte: sixMonthsFromNow },
      user: { phone: { not: null } },
    },
    select: {
      id: true,
      category: true,
      name: true,
      fileName: true,
      expiresAt: true,
      reminderLastSentAt: true,
      userId: true,
      user: { select: { phone: true, name: true } },
    },
  })

  let sent = 0
  for (const doc of docs) {
    const phone = doc.user?.phone
    if (!phone) continue

    const expiresAt = doc.expiresAt!
    const lastSent = doc.reminderLastSentAt
    const shouldSend = !lastSent || lastSent < oneWeekAgo

    if (!shouldSend) continue

    const categoryLabel = doc.category === 'IDENTIFICACIONES' ? 'identificación' : doc.category === 'ACTAS' ? 'acta' : 'documento'
    const label = doc.name || doc.fileName || categoryLabel
    const dateStr = new Date(expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    const msg = `Recordatorio Domus+: Tu ${categoryLabel} "${label}" vence el ${dateStr}. Sube la nueva versión en Mis documentos cuando la tengas para mantener tu respaldo al día.`

    const res = await sendWhatsAppMessage(phone, msg)
    if (res.ok) {
      sent++
      await prisma.userDocument.update({
        where: { id: doc.id },
        data: { reminderLastSentAt: now },
      })
    }
  }

  return NextResponse.json({ ok: true, candidates: docs.length, remindersSent: sent })
}
