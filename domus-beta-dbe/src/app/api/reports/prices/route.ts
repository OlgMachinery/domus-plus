/**
 * D1-D2: API de histórico de precios por producto.
 * GET /api/reports/prices?from=YYYY-MM-DD&to=YYYY-MM-DD&product=opcional
 * Agrupa por (producto normalizado, unidad); calcula unitPrice cuando falta (amount/quantity).
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { normalizeProductName, normalizeUnit, productKey } from '@/lib/consumption/normalize'

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

/** D2: Obtiene precio unitario estable: amount/quantity o unitPrice. */
function getUnitPrice(item: { amount?: unknown; quantity?: unknown; unitPrice?: unknown }): number | null {
  const amount = toNum(item.amount)
  const qty = toNum(item.quantity)
  const up = toNum(item.unitPrice)
  if (qty > 0 && amount > 0) return Math.round((amount / qty) * 100) / 100
  if (qty > 0 && up > 0) return up
  if (up > 0) return up
  return null
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)
    const from = parseDateParam(url.searchParams.get('from'))
    const to = parseDateParam(url.searchParams.get('to'))
    const productFilter = (url.searchParams.get('product') || '').trim().toLowerCase()

    const extractions = await prisma.receiptExtraction.findMany({
      where: { familyId },
      select: {
        id: true,
        merchantName: true,
        receiptDate: true,
        receipt: { select: { transaction: { select: { date: true } } } },
        items: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
            quantityUnit: true,
          },
        },
      },
      orderBy: { receiptDate: 'asc' },
    })

    type PricePoint = { date: string; merchantName: string | null; unitPrice: number; quantity: number; amount: number }
    const byProduct: Record<string, { productKey: string; description: string; unit: string; prices: PricePoint[] }> = {}

    for (const ext of extractions) {
      const refDate = ext.receiptDate ?? ext.receipt?.transaction?.date
      const dateStr = refDate ? new Date(refDate).toISOString().slice(0, 10) : ''
      if (from && dateStr && dateStr < from.toISOString().slice(0, 10)) continue
      if (to && dateStr && dateStr > to.toISOString().slice(0, 10)) continue

      const merchantName = ext.merchantName?.trim() || null

      for (const it of ext.items) {
        const unitRaw = (it.quantityUnit || '').trim()
        const unit = normalizeUnit(unitRaw)
        const desc = (it.description || '').trim() || 'sin descripción'
        const key = productKey(desc, unit)
        if (productFilter && !key.toLowerCase().includes(productFilter) && !desc.toLowerCase().includes(productFilter)) continue

        const unitPrice = getUnitPrice(it)
        if (unitPrice == null || unitPrice <= 0) continue
        const quantity = toNum(it.quantity) || 1
        const amount = toNum(it.amount) || unitPrice * quantity

        if (!byProduct[key]) {
          byProduct[key] = {
            productKey: key,
            description: normalizeProductName(desc),
            unit,
            prices: [],
          }
        }
        byProduct[key].prices.push({
          date: dateStr,
          merchantName,
          unitPrice,
          quantity,
          amount,
        })
      }
    }

    const products = Object.values(byProduct).map((p) => ({
      ...p,
      prices: p.prices.sort((a, b) => a.date.localeCompare(b.date)),
    }))

    return NextResponse.json({
      ok: true,
      from: from ? from.toISOString().slice(0, 10) : null,
      to: to ? to.toISOString().slice(0, 10) : null,
      products,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al obtener precios', 500)
  }
}
