/**
 * G1: Cron de alertas de incremento de precio.
 * Por familia: detecta productos con subida > umbral y notifica al admin por WhatsApp.
 * GET /api/cron/price-alerts?secret=CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { loadPriceHistory, detectPriceIncreases } from '@/lib/consumption/price-analysis'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const INCREASE_THRESHOLD_PCT = 5
const MAX_ALERTS_PER_FAMILY = 5

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const families = await prisma.family.findMany({ select: { id: true } })
  let sent = 0
  for (const family of families) {
    const byProduct = await loadPriceHistory(family.id, {})
    const increases = detectPriceIncreases(byProduct, {
      recentDays: 30,
      previousDays: 60,
      increaseThresholdPct: INCREASE_THRESHOLD_PCT,
    })
    if (increases.length === 0) continue

    const admin = await prisma.familyMember.findFirst({
      where: { familyId: family.id, isFamilyAdmin: true },
      select: { user: { select: { phone: true } } },
    })
    if (!admin?.user?.phone) continue

    const lines = increases.slice(0, MAX_ALERTS_PER_FAMILY).map(
      (i) => `• ${i.productKey}: +${i.changePercent.toFixed(1)}% ($${i.previousAvg} → $${i.recentAvg})`,
    )
    const msg = `📈 *DOMUS — Subidas de precio detectadas*\n\nEn tu historial de recibos:\n${lines.join('\n')}\n\nRevisa en la app (Precios y consumos) para más detalle.`
    const res = await sendWhatsAppMessage(admin.user.phone, msg)
    if (res.ok) sent++
  }

  return NextResponse.json({ ok: true, familiesProcessed: families.length, alertsSent: sent })
}
