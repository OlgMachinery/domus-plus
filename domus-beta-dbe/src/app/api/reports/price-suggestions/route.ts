/**
 * F1, F2: Sugerencias mejor precio por producto y "qué comprar esta semana".
 * Incluye E1 (incrementos) y E3 (anomalías utilidades) para el panel.
 * GET /api/reports/price-suggestions?from=&to=
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import {
  loadPriceHistory,
  detectPriceIncreases,
  getPriceByMerchant,
  getUtilityAnomalies,
} from '@/lib/consumption/price-analysis'

export const dynamic = 'force-dynamic'

const TOP_PRODUCTS = 10
const BUY_THIS_WEEK_DAYS = 21
const MIN_PURCHASES_FOR_SUGGESTION = 2

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)
    const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : new Date()
    const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : new Date(to.getFullYear(), to.getMonth() - 3, 1)

    const [byProduct, anomalies] = await Promise.all([
      loadPriceHistory(familyId, { from, to }),
      getUtilityAnomalies(familyId, { from, to }),
    ])

    const increases = detectPriceIncreases(byProduct, { recentDays: 30, previousDays: 60, increaseThresholdPct: 5 })

    // F1: Mejor precio por producto (top productos por frecuencia, mejor comercio y precio reciente)
    const productEntries = Array.from(byProduct.entries())
      .filter(([, points]) => points.length >= MIN_PURCHASES_FOR_SUGGESTION)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, TOP_PRODUCTS)

    const bestPricePerProduct: Array<{
      productKey: string
      description: string
      unit: string
      bestMerchant: string | null
      bestPrice: number
      lastDate: string
      byMerchant: Array<{ merchantName: string | null; avgPrice: number; lastPrice: number; count: number }>
    }> = []

    for (const [key, points] of productEntries) {
      const byMerchant = getPriceByMerchant(points)
      const best = byMerchant.sort((a, b) => a.lastPrice - b.lastPrice)[0]
      if (!best) continue
      const lastPoint = points.sort((a, b) => b.date.localeCompare(a.date))[0]
      const [desc, unit] = key.split('|')
      bestPricePerProduct.push({
        productKey: key,
        description: desc ?? key,
        unit: unit ?? '—',
        bestMerchant: best.merchantName,
        bestPrice: best.lastPrice,
        lastDate: lastPoint?.date ?? '',
        byMerchant,
      })
    }

    // F2: Qué comprar esta semana — productos con buen precio reciente y comprados hace >14 días (reposición)
    const now = new Date()
    const repoSplit = new Date(now.getTime() - BUY_THIS_WEEK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const buyThisWeek: Array<{
      productKey: string
      description: string
      unit: string
      suggestedMerchant: string | null
      suggestedPrice: number
      lastPurchaseDate: string | null
      daysSincePurchase: number | null
    }> = []

    for (const [key, points] of productEntries) {
      const sorted = [...points].sort((a, b) => b.date.localeCompare(a.date))
      const lastDate = sorted[0]?.date
      if (!lastDate) continue
      if (lastDate >= repoSplit) continue
      const daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (24 * 60 * 60 * 1000))
      const byMerchant = getPriceByMerchant(points)
      const best = byMerchant.sort((a, b) => a.avgPrice - b.avgPrice)[0]
      if (!best) continue
      const [desc, unit] = key.split('|')
      buyThisWeek.push({
        productKey: key,
        description: desc ?? key,
        unit: unit ?? '—',
        suggestedMerchant: best.merchantName,
        suggestedPrice: best.avgPrice,
        lastPurchaseDate: lastDate,
        daysSincePurchase: daysSince,
      })
    }
    buyThisWeek.sort((a, b) => (b.daysSincePurchase ?? 0) - (a.daysSincePurchase ?? 0))
    const buyThisWeekSlice = buyThisWeek.slice(0, 5)

    return NextResponse.json({
      ok: true,
      bestPricePerProduct,
      buyThisWeek: buyThisWeekSlice,
      priceIncreases: increases,
      utilityAnomalies: anomalies,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al obtener sugerencias', 500)
  }
}
