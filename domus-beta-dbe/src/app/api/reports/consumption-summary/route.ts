/**
 * F3: Resumen mensual de precios y consumos (texto).
 * GET /api/reports/consumption-summary?month=YYYY-MM
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { buildConsumptionSummary } from '@/lib/consumption/summary'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)
    const monthParam = url.searchParams.get('month')
    const month = monthParam ? new Date(monthParam + '-01') : new Date()
    if (Number.isNaN(month.getTime())) {
      return jsonError('Parámetro month inválido (use YYYY-MM)', 400)
    }
    const text = await buildConsumptionSummary(familyId, { month })
    return NextResponse.json({ ok: true, summary: text, month: month.toISOString().slice(0, 7) })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al generar resumen', 500)
  }
}
