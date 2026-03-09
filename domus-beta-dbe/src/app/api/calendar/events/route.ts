/**
 * DOMUS Time Engine — API principal del calendario unificado.
 * GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Devuelve lista unificada de eventos con source_table/source_id para navegar al origen.
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { getCalendarEvents } from '@/lib/calendar/time-engine'

export const dynamic = 'force-dynamic'

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const url = new URL(req.url)
    const fromParam = parseDateParam(url.searchParams.get('from'))
    const toParam = parseDateParam(url.searchParams.get('to'))

    const to = toParam ?? new Date()
    const from = fromParam ?? new Date(to.getFullYear(), to.getMonth(), 1)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)

    const { events, familyName, cutoffDay } = await getCalendarEvents(familyId, from, to)

    const paymentEvents = events.filter((e) => e.type === 'payment' || e.type === 'payment_expected')
    const completed = events.filter((e) => e.type === 'payment' && e.status === 'completed')
    const pending = events.filter((e) => e.type === 'payment_expected' || (e.type === 'money_request' && e.status === 'PENDING'))
    const totalCommitted = paymentEvents.reduce((sum, e) => sum + (e.amount ?? 0), 0)

    return NextResponse.json({
      ok: true,
      from: fromStr,
      to: toStr,
      familyName,
      cutoffDay,
      events,
      summary: {
        totalEvents: events.length,
        paymentsPending: pending.length,
        paymentsCompleted: completed.length,
        totalCommitted: Math.round(totalCommitted * 100) / 100,
      },
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al obtener eventos', 500)
  }
}
