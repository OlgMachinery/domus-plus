/**
 * E1, E2, E3: Análisis de precios (incrementos, por comercio) y anomalías en utilidades.
 */
import { prisma } from '@/lib/db/prisma'
import { normalizeProductName, normalizeUnit, productKey } from './normalize'

function toNum(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function getUnitPrice(item: { amount?: unknown; quantity?: unknown; unitPrice?: unknown }): number | null {
  const amount = toNum(item.amount)
  const qty = toNum(item.quantity)
  const up = toNum(item.unitPrice)
  if (qty > 0 && amount > 0) return amount / qty
  if (qty > 0 && up > 0) return up
  if (up > 0) return up
  return null
}

export type PricePoint = { date: string; merchantName: string | null; unitPrice: number; quantity: number }

/** Carga histórico de precios por producto para una familia (últimos 12 meses por defecto). */
export async function loadPriceHistory(
  familyId: string,
  options: { from?: Date; to?: Date; productKeyFilter?: string } = {},
): Promise<Map<string, PricePoint[]>> {
  const to = options.to ?? new Date()
  const from = options.from ?? new Date(to.getFullYear(), to.getMonth() - 12, 1)
  const extractions = await prisma.receiptExtraction.findMany({
    where: { familyId },
    select: {
      merchantName: true,
      receiptDate: true,
      receipt: { select: { transaction: { select: { date: true } } } },
      items: { select: { description: true, quantity: true, unitPrice: true, amount: true, quantityUnit: true } },
    },
  })

  const byProduct = new Map<string, PricePoint[]>()
  for (const ext of extractions) {
    const refDate = ext.receiptDate ?? ext.receipt?.transaction?.date
    const dateStr = refDate ? new Date(refDate).toISOString().slice(0, 10) : ''
    if (dateStr < from.toISOString().slice(0, 10) || dateStr > to.toISOString().slice(0, 10)) continue
    for (const it of ext.items) {
      const unit = normalizeUnit((it.quantityUnit || '').trim())
      const desc = (it.description || '').trim() || 'sin descripción'
      const key = productKey(desc, unit)
      if (options.productKeyFilter && !key.toLowerCase().includes(options.productKeyFilter.toLowerCase())) continue
      const unitPrice = getUnitPrice(it)
      if (unitPrice == null || unitPrice <= 0) continue
      const list = byProduct.get(key) ?? []
      list.push({
        date: dateStr,
        merchantName: ext.merchantName?.trim() || null,
        unitPrice,
        quantity: toNum(it.quantity) || 1,
      })
      byProduct.set(key, list)
    }
  }
  return byProduct
}

/** E1: Detecta incremento de precio: compara precio reciente vs ventana anterior. */
export type PriceChangeResult = {
  productKey: string
  status: 'up' | 'down' | 'stable'
  changePercent: number
  recentAvg: number
  previousAvg: number
  recentCount: number
  previousCount: number
}

const DEFAULT_RECENT_DAYS = 30
const DEFAULT_PREVIOUS_DAYS = 90
const DEFAULT_INCREASE_THRESHOLD_PCT = 5

export function detectPriceIncreases(
  byProduct: Map<string, PricePoint[]>,
  options: {
    recentDays?: number
    previousDays?: number
    increaseThresholdPct?: number;
  } = {},
): PriceChangeResult[] {
  const recentDays = options.recentDays ?? DEFAULT_RECENT_DAYS
  const previousDays = options.previousDays ?? DEFAULT_PREVIOUS_DAYS
  const threshold = options.increaseThresholdPct ?? DEFAULT_INCREASE_THRESHOLD_PCT
  const now = new Date()
  const recentCut = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const previousCut = new Date(now.getTime() - (recentDays + previousDays) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const results: PriceChangeResult[] = []
  for (const [key, points] of byProduct) {
    const recent = points.filter((p) => p.date >= recentCut)
    const previous = points.filter((p) => p.date < recentCut && p.date >= previousCut)
    if (recent.length < 1 || previous.length < 1) continue
    const recentAvg = recent.reduce((s, p) => s + p.unitPrice, 0) / recent.length
    const previousAvg = previous.reduce((s, p) => s + p.unitPrice, 0) / previous.length
    if (previousAvg <= 0) continue
    const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100
    let status: 'up' | 'down' | 'stable' = 'stable'
    if (changePercent >= threshold) status = 'up'
    else if (changePercent <= -threshold) status = 'down'
    results.push({
      productKey: key,
      status,
      changePercent: Math.round(changePercent * 100) / 100,
      recentAvg: Math.round(recentAvg * 100) / 100,
      previousAvg: Math.round(previousAvg * 100) / 100,
      recentCount: recent.length,
      previousCount: previous.length,
    })
  }
  return results.filter((r) => r.status === 'up').sort((a, b) => b.changePercent - a.changePercent)
}

/** E2: Precio por comercio para un producto. */
export type MerchantPrice = { merchantName: string | null; avgPrice: number; lastPrice: number; count: number }

export function getPriceByMerchant(points: PricePoint[]): MerchantPrice[] {
  const byMerchant = new Map<string, number[]>()
  for (const p of points) {
    const k = p.merchantName ?? '(sin comercio)'
    const list = byMerchant.get(k) ?? []
    list.push(p.unitPrice)
    byMerchant.set(k, list)
  }
  return Array.from(byMerchant.entries()).map(([merchantName, prices]) => {
    const sorted = [...prices].sort((a, b) => a - b)
    const avg = prices.reduce((s, n) => s + n, 0) / prices.length
    return {
      merchantName: merchantName === '(sin comercio)' ? null : merchantName,
      avgPrice: Math.round(avg * 100) / 100,
      lastPrice: sorted[sorted.length - 1] ?? 0,
      count: prices.length,
    }
  })
}

/** E3: Anomalías en utilidades (consumo por encima del promedio histórico). */
export type UtilityAnomaly = {
  receiptId: string
  unit: 'kWh' | 'm3'
  quantity: number
  periodStart: string | null
  periodEnd: string | null
  merchantName: string | null
  percentAboveAvg: number
  historicalAvg: number
}

const ANOMALY_THRESHOLD_PCT = 30

export async function getUtilityAnomalies(
  familyId: string,
  options: { from?: Date; to?: Date; thresholdPct?: number } = {},
): Promise<UtilityAnomaly[]> {
  const threshold = options.thresholdPct ?? ANOMALY_THRESHOLD_PCT
  const extractions = await prisma.receiptExtraction.findMany({
    where: { familyId },
    select: {
      receiptId: true,
      merchantName: true,
      consumptionQuantity: true,
      consumptionUnit: true,
      consumptionPeriodStart: true,
      consumptionPeriodEnd: true,
    },
  })

  const kwhValues: number[] = []
  const m3Values: number[] = []
  const records: Array<{
    receiptId: string
    unit: 'kWh' | 'm3'
    quantity: number
    periodStart: string | null
    periodEnd: string | null
    merchantName: string | null
  }> = []

  for (const e of extractions) {
    const qty = toNum(e.consumptionQuantity)
    if (qty <= 0 || !e.consumptionUnit) continue
    const unit = String(e.consumptionUnit).toLowerCase().replace(/\s/g, '') === 'm3' ? 'm3' : 'kWh'
    if (unit === 'kWh') kwhValues.push(qty)
    else m3Values.push(qty)
    records.push({
      receiptId: e.receiptId,
      unit: unit as 'kWh' | 'm3',
      quantity: qty,
      periodStart: e.consumptionPeriodStart ? e.consumptionPeriodStart.toISOString().slice(0, 10) : null,
      periodEnd: e.consumptionPeriodEnd ? e.consumptionPeriodEnd.toISOString().slice(0, 10) : null,
      merchantName: e.merchantName ?? null,
    })
  }

  const avgKwh = kwhValues.length ? kwhValues.reduce((a, b) => a + b, 0) / kwhValues.length : 0
  const avgM3 = m3Values.length ? m3Values.reduce((a, b) => a + b, 0) / m3Values.length : 0
  const anomalies: UtilityAnomaly[] = []
  for (const r of records) {
    const avg = r.unit === 'kWh' ? avgKwh : avgM3
    if (avg <= 0) continue
    const pctAbove = ((r.quantity - avg) / avg) * 100
    if (pctAbove >= threshold) {
      anomalies.push({
        ...r,
        percentAboveAvg: Math.round(pctAbove * 100) / 100,
        historicalAvg: Math.round(avg * 100) / 100,
      })
    }
  }
  return anomalies.sort((a, b) => b.percentAboveAvg - a.percentAboveAvg)
}
