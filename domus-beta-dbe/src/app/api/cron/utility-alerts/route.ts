/**
 * G2: Cron de alerta de consumo anómalo (luz/agua).
 * Por familia: si hay facturas con consumo por encima del promedio, notifica al admin.
 * GET /api/cron/utility-alerts?secret=CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { getUtilityAnomalies } from '@/lib/consumption/price-analysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_ALERTS_PER_FAMILY = 3

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const families = await prisma.family.findMany({ select: { id: true } })
  let sent = 0
  for (const family of families) {
    const anomalies = await getUtilityAnomalies(family.id, { thresholdPct: 30 })
    if (anomalies.length === 0) continue

    const admin = await prisma.familyMember.findFirst({
      where: { familyId: family.id, isFamilyAdmin: true },
      select: { user: { select: { phone: true } } },
    })
    if (!admin?.user?.phone) continue

    const lines = anomalies.slice(0, MAX_ALERTS_PER_FAMILY).map(
      (a) => `• ${a.unit} (${a.merchantName ?? 'recibo'}): +${a.percentAboveAvg.toFixed(0)}% sobre tu promedio`,
    )
    const msg = `⚠️ *DOMUS — Consumo por encima del promedio*\n\n${lines.join('\n')}\n\nRevisa en la app (Precios y consumos).`
    const res = await sendWhatsAppMessage(admin.user.phone, msg)
    if (res.ok) sent++
  }

  return NextResponse.json({ ok: true, familiesProcessed: families.length, alertsSent: sent })
}
