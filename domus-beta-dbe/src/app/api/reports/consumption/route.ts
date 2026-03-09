import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { normalizeProductName, normalizeUnit, productKey as buildProductKey } from '@/lib/consumption/normalize'

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

/** GET /api/reports/consumption?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Devuelve consumo de luz/agua (kWh, m³) y productos con cantidad/unidad para reportes e historial/reposición.
 */
export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)
    const from = parseDateParam(url.searchParams.get('from'))
    const to = parseDateParam(url.searchParams.get('to'))

    const extractions = await prisma.receiptExtraction.findMany({
      where: { familyId },
      include: {
        receipt: { include: { transaction: { select: { id: true, date: true, userId: true } } } },
        items: true,
      },
      orderBy: { receiptDate: 'asc' },
    })

    // Filtrar por rango: usar transaction.date si no hay receiptDate
    let filtered = extractions
    if (from || to) {
      filtered = extractions.filter((e) => {
        const txDate = e.receipt?.transaction?.date
        const recDate = e.receiptDate
        const refDate = recDate ?? txDate
        if (!refDate) return true
        const t = new Date(refDate).getTime()
        if (from && t < from.getTime()) return false
        if (to && t > to.getTime()) return false
        return true
      })
    }

    // Utilidades: recibos con consumptionQuantity (luz kWh, agua m³)
    const utility: Array<{
      receiptId: string
      receiptDate: string | null
      periodStart: string | null
      periodEnd: string | null
      unit: string
      quantity: number
      merchantName: string | null
    }> = []
    for (const e of filtered) {
      const qty = toNum(e.consumptionQuantity)
      if (qty <= 0 || !e.consumptionUnit) continue
      const unit = String(e.consumptionUnit).toLowerCase().replace(/\s/g, '') === 'm3' ? 'm3' : 'kWh'
      utility.push({
        receiptId: e.receiptId,
        receiptDate: e.receiptDate ? e.receiptDate.toISOString().slice(0, 10) : null,
        periodStart: e.consumptionPeriodStart ? e.consumptionPeriodStart.toISOString().slice(0, 10) : null,
        periodEnd: e.consumptionPeriodEnd ? e.consumptionPeriodEnd.toISOString().slice(0, 10) : null,
        unit,
        quantity: qty,
        merchantName: e.merchantName,
      })
    }

    // Productos: agrupados por nombre normalizado + unidad normalizada (C3: 1L/1 L unificados)
    const productKey = (desc: string, unit: string) => buildProductKey(desc, unit)
    const productSums: Record<
      string,
      { description: string; unit: string; totalQuantity: number; count: number; receiptDates: string[]; receiptIds: string[] }
    > = {}
    const productByReceipt: Array<{ key: string; receiptId: string; date: string; quantity: number }> = []

    for (const e of filtered) {
      const txDate = e.receipt?.transaction?.date
      const recDate = e.receiptDate ?? txDate
      const dateStr = recDate ? new Date(recDate).toISOString().slice(0, 10) : ''

      for (const it of e.items) {
        const unitRaw = (it.quantityUnit || '').trim()
        if (!unitRaw) continue
        const unit = normalizeUnit(unitRaw)
        const qty = toNum(it.quantity) || 0
        const rawDesc = (it.description || '').trim() || 'Sin descripción'
        const key = productKey(rawDesc, unit)
        const displayName = normalizeProductName(rawDesc)
        if (!productSums[key]) {
          productSums[key] = { description: displayName, unit, totalQuantity: 0, count: 0, receiptDates: [], receiptIds: [] }
        }
        productSums[key].totalQuantity += qty
        productSums[key].count += 1
        if (e.receiptId && !productSums[key].receiptIds.includes(e.receiptId)) {
          productSums[key].receiptIds.push(e.receiptId)
          if (dateStr) productSums[key].receiptDates.push(dateStr)
        }
        if (qty > 0 && dateStr) productByReceipt.push({ key, receiptId: e.receiptId, date: dateStr, quantity: qty })
      }
    }

    const products = Object.values(productSums).map((p) => ({
      ...p,
      receiptDates: [...new Set(p.receiptDates)].sort(),
    }))

    // Misma lista agrupada, con formato para la pestaña "agrupado" (displayName, receiptCount)
    const productsGrouped = products.map((p) => ({
      displayName: p.description,
      unit: p.unit,
      totalQuantity: p.totalQuantity,
      count: p.count,
      receiptCount: p.receiptIds.length,
      receiptDates: p.receiptDates,
    }))

    // Reposición: por producto (key), días entre compras consecutivas
    const repoSorted = productByReceipt.sort((a, b) => a.date.localeCompare(b.date))
    const repoByKey: Record<string, string[]> = {}
    const prevByKey: Record<string, { date: string }> = {}
    for (const r of repoSorted) {
      const prev = prevByKey[r.key]
      if (prev) {
        const d1 = new Date(prev.date).getTime()
        const d2 = new Date(r.date).getTime()
        const days = Math.round((d2 - d1) / (24 * 60 * 60 * 1000))
        if (days > 0) {
          if (!repoByKey[r.key]) repoByKey[r.key] = []
          repoByKey[r.key].push(`${days} días`)
        }
      }
      prevByKey[r.key] = { date: r.date }
    }
    const reposicion = Object.entries(repoByKey).map(([key, daysStrs]) => {
      const lastPipe = key.lastIndexOf('|')
      const desc = lastPipe >= 0 ? key.slice(0, lastPipe) : key
      const unit = lastPipe >= 0 ? key.slice(lastPipe + 1) : ''
      const nums = daysStrs.map((s) => parseInt(s.replace(/\D/g, ''), 10)).filter((n) => Number.isFinite(n))
      const avg = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0
      return { description: desc, unit, betweenPurchasesDays: daysStrs, avgDays: avg }
    })

    return NextResponse.json({
      ok: true,
      from: from ? from.toISOString().slice(0, 10) : null,
      to: to ? to.toISOString().slice(0, 10) : null,
      utility,
      products,
      productsGrouped,
      reposicion,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al obtener consumo', 500)
  }
}
