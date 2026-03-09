/**
 * F3: Resumen mensual de precios y consumos (texto para WhatsApp o panel).
 */
import { prisma } from '@/lib/db/prisma'
import {
  loadPriceHistory,
  detectPriceIncreases,
  getUtilityAnomalies,
} from './price-analysis'

function toNum(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function buildConsumptionSummary(
  familyId: string,
  options: { month?: Date; maxIncreaseItems?: number } = {},
): Promise<string> {
  const ref = options.month ?? new Date()
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1)
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999)
  const from = new Date(ref.getFullYear(), ref.getMonth() - 6, 1)
  const to = monthEnd
  const maxItems = options.maxIncreaseItems ?? 5

  const [extractions, byProduct, anomalies] = await Promise.all([
    prisma.receiptExtraction.findMany({
      where: {
        familyId,
        receiptDate: { gte: monthStart, lte: monthEnd },
        total: { not: null },
      },
      select: { total: true },
    }),
    loadPriceHistory(familyId, { from, to }),
    getUtilityAnomalies(familyId, { from: monthStart, to: monthEnd }),
  ])

  const receiptTotal = extractions.reduce((s, e) => s + toNum(e.total), 0)
  const increases = detectPriceIncreases(byProduct, { recentDays: 30, previousDays: 60, increaseThresholdPct: 5 })
  const increaseLines = increases.slice(0, maxItems).map((i) => `  • ${i.productKey}: +${i.changePercent.toFixed(1)}% ($${i.previousAvg} → $${i.recentAvg})`)

  const kwhRecords = anomalies.filter((a) => a.unit === 'kWh')
  const m3Records = anomalies.filter((a) => a.unit === 'm3')
  const totalKwh = kwhRecords.reduce((s, a) => s + a.quantity, 0)
  const totalM3 = m3Records.reduce((s, a) => s + a.quantity, 0)
  const avgKwh = kwhRecords.length ? kwhRecords.reduce((s, a) => s + a.historicalAvg, 0) / kwhRecords.length : 0
  const avgM3 = m3Records.length ? m3Records.reduce((s, a) => s + a.historicalAvg, 0) / m3Records.length : 0
  const pctKwh = avgKwh > 0 ? ((totalKwh - avgKwh) / avgKwh) * 100 : 0
  const pctM3 = avgM3 > 0 ? ((totalM3 - avgM3) / avgM3) * 100 : 0

  const monthName = monthStart.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const lines: string[] = [
    `*Resumen de precios y consumos — ${monthName}*`,
    '',
    `📦 *Gasto en recibos del mes:* $${receiptTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ]
  if (increaseLines.length) {
    lines.push('', '📈 *Productos con subida de precio:*', ...increaseLines)
  }
  if (totalKwh > 0 || totalM3 > 0) {
    lines.push('')
    if (totalKwh > 0) {
      const vs = avgKwh > 0 ? ` (${pctKwh >= 0 ? '+' : ''}${pctKwh.toFixed(0)}% vs promedio)` : ''
      lines.push(`⚡ *Luz:* ${totalKwh.toFixed(1)} kWh${vs}`)
    }
    if (totalM3 > 0) {
      const vs = avgM3 > 0 ? ` (${pctM3 >= 0 ? '+' : ''}${pctM3.toFixed(0)}% vs promedio)` : ''
      lines.push(`💧 *Agua:* ${totalM3.toFixed(1)} m³${vs}`)
    }
  }
  if (anomalies.length > 0) {
    lines.push('', '⚠️ *Consumo por encima del promedio:*')
    for (const a of anomalies.slice(0, 3)) {
      lines.push(`  • ${a.unit}: +${a.percentAboveAvg.toFixed(0)}% (${a.merchantName ?? 'recibo'})`)
    }
  }
  return lines.join('\n')
}
