/**
 * D3: Totales de utilidades (luz/agua) por periodo.
 * GET /api/reports/utility-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function toNum(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)
    const from = parseDateParam(url.searchParams.get('from'))
    const to = parseDateParam(url.searchParams.get('to'))

    const extractions = await prisma.receiptExtraction.findMany({
      where: { familyId },
      select: {
        receiptId: true,
        merchantName: true,
        receiptDate: true,
        consumptionQuantity: true,
        consumptionUnit: true,
        consumptionPeriodStart: true,
        consumptionPeriodEnd: true,
      },
      orderBy: { receiptDate: 'asc' },
    })

    const records: Array<{
      receiptId: string
      receiptDate: string | null
      periodStart: string | null
      periodEnd: string | null
      unit: 'kWh' | 'm3'
      quantity: number
      merchantName: string | null
    }> = []

    for (const e of extractions) {
      const qty = toNum(e.consumptionQuantity)
      if (qty <= 0 || !e.consumptionUnit) continue
      const unit = String(e.consumptionUnit).toLowerCase().replace(/\s/g, '') === 'm3' ? 'm3' : 'kWh'
      const recDate = e.receiptDate ? e.receiptDate.toISOString().slice(0, 10) : null
      if (from && recDate && recDate < from.toISOString().slice(0, 10)) continue
      if (to && recDate && recDate > to.toISOString().slice(0, 10)) continue
      records.push({
        receiptId: e.receiptId,
        receiptDate: recDate,
        periodStart: e.consumptionPeriodStart ? e.consumptionPeriodStart.toISOString().slice(0, 10) : null,
        periodEnd: e.consumptionPeriodEnd ? e.consumptionPeriodEnd.toISOString().slice(0, 10) : null,
        unit,
        quantity: qty,
        merchantName: e.merchantName ?? null,
      })
    }

    const byPeriod: Record<string, { kWh: number; m3: number; receipts: string[]; merchants: string[] }> = {}
    let totalKwh = 0
    let totalM3 = 0
    for (const r of records) {
      const periodKey = r.periodStart && r.periodEnd ? `${r.periodStart}_${r.periodEnd}` : (r.receiptDate || r.receiptId)
      if (!byPeriod[periodKey]) {
        byPeriod[periodKey] = { kWh: 0, m3: 0, receipts: [], merchants: [] }
      }
      if (r.unit === 'kWh') {
        byPeriod[periodKey].kWh += r.quantity
        totalKwh += r.quantity
      } else {
        byPeriod[periodKey].m3 += r.quantity
        totalM3 += r.quantity
      }
      if (!byPeriod[periodKey].receipts.includes(r.receiptId)) byPeriod[periodKey].receipts.push(r.receiptId)
      if (r.merchantName && !byPeriod[periodKey].merchants.includes(r.merchantName)) byPeriod[periodKey].merchants.push(r.merchantName)
    }

    const periods = Object.entries(byPeriod).map(([key, v]) => ({
      periodKey: key,
      kWh: Math.round(v.kWh * 100) / 100,
      m3: Math.round(v.m3 * 100) / 100,
      receiptCount: v.receipts.length,
      merchants: v.merchants,
    }))

    return NextResponse.json({
      ok: true,
      from: from ? from.toISOString().slice(0, 10) : null,
      to: to ? to.toISOString().slice(0, 10) : null,
      totalKwh: Math.round(totalKwh * 100) / 100,
      totalM3: Math.round(totalM3 * 100) / 100,
      periods,
      records,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al obtener resumen de utilidades', 500)
  }
}
