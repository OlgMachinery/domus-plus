/**
 * Calendario unificado: pagos, día de corte, solicitudes, facturas, etc.
 * GET /api/calendar/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Devuelve paid, upcoming, recurring y events (lista unificada para vista e impresión).
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { detectRecurringPayments, getUpcomingExpectedPayments } from '@/lib/calendar/recurring-engine'

export const dynamic = 'force-dynamic'

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

type CalendarEvent = {
  type: string
  date: string
  label: string
  amount?: string | number
  id?: string
  meta?: Record<string, unknown>
}

function addEvent(events: CalendarEvent[], ev: CalendarEvent) {
  events.push(ev)
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

    const [family, paid, upcoming, recurringAll, moneyRequests, extractionsUtility] = await Promise.all([
      prisma.family.findUnique({
        where: { id: familyId },
        select: { name: true, cutoffDay: true },
      }),
      prisma.transaction.findMany({
        where: { familyId, date: { gte: from, lte: to } },
        select: {
          id: true,
          date: true,
          amount: true,
          description: true,
          registrationCode: true,
          allocationId: true,
          allocation: {
            select: {
              category: { select: { name: true } },
              entity: { select: { name: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
      getUpcomingExpectedPayments(familyId, from, to),
      detectRecurringPayments(familyId, {}),
      prisma.moneyRequest.findMany({
        where: {
          familyId,
          OR: [
            { requestedAt: { gte: from, lte: to } },
            { deliveredAt: { gte: from, lte: to } },
          ],
        },
        select: { id: true, amount: true, reason: true, status: true, requestedAt: true, deliveredAt: true, registrationCode: true },
      }),
      prisma.receiptExtraction.findMany({
        where: {
          familyId,
          consumptionQuantity: { not: null },
          consumptionUnit: { not: null },
          consumptionPeriodEnd: { gte: from, lte: to },
        },
        select: { receiptId: true, merchantName: true, consumptionPeriodEnd: true, consumptionUnit: true },
      }),
    ])

    const events: CalendarEvent[] = []

    for (const t of paid) {
      const dateStr = t.date.toISOString().slice(0, 10)
      addEvent(events, {
        type: 'payment',
        date: dateStr,
        label: t.description || t.allocation?.category?.name || 'Gasto',
        amount: String(t.amount),
        id: t.id,
        meta: { registrationCode: t.registrationCode, categoryName: t.allocation?.category?.name, entityName: t.allocation?.entity?.name },
      })
    }

    for (const u of upcoming) {
      addEvent(events, {
        type: 'payment_expected',
        date: u.nextExpectedDate,
        label: u.label,
        amount: u.suggestedAmount,
        id: u.id,
        meta: { categoryName: u.categoryName, confidence: u.confidence },
      })
    }

    const cutoffDay = family?.cutoffDay ?? 1
    const yFrom = from.getFullYear()
    const mFrom = from.getMonth()
    const yTo = to.getFullYear()
    const mTo = to.getMonth()
    for (let y = yFrom; y <= yTo; y++) {
      const mStart = y === yFrom ? mFrom : 0
      const mEnd = y === yTo ? mTo : 11
      for (let m = mStart; m <= mEnd; m++) {
        const lastDay = new Date(y, m + 1, 0).getDate()
        const day = Math.min(cutoffDay, lastDay)
        const cutoffDate = new Date(y, m, day)
        if (cutoffDate >= from && cutoffDate <= to) {
          addEvent(events, {
            type: 'cutoff',
            date: cutoffDate.toISOString().slice(0, 10),
            label: 'Cierre de periodo presupuestal',
            meta: { day: cutoffDay },
          })
        }
      }
    }

    for (const mr of moneyRequests) {
      if (mr.requestedAt >= from && mr.requestedAt <= to) {
        addEvent(events, {
          type: 'money_request',
          date: mr.requestedAt.toISOString().slice(0, 10),
          label: `Solicitud: ${mr.reason || 'efectivo'}`,
          amount: Number(mr.amount),
          id: mr.id,
          meta: { status: mr.status, registrationCode: mr.registrationCode },
        })
      }
      if (mr.deliveredAt && mr.deliveredAt >= from && mr.deliveredAt <= to) {
        addEvent(events, {
          type: 'money_delivered',
          date: mr.deliveredAt.toISOString().slice(0, 10),
          label: `Entrega efectivo: ${mr.reason || '—'}`,
          amount: Number(mr.amount),
          id: mr.id,
          meta: { registrationCode: mr.registrationCode },
        })
      }
    }

    for (const e of extractionsUtility) {
      if (!e.consumptionPeriodEnd) continue
      const dateStr = e.consumptionPeriodEnd.toISOString().slice(0, 10)
      if (dateStr >= fromStr && dateStr <= toStr) {
        const unit = String(e.consumptionUnit || '').toLowerCase().replace(/\s/g, '') === 'm3' ? 'Agua' : 'Luz'
        addEvent(events, {
          type: 'utility_reminder',
          date: dateStr,
          label: `Factura ${unit} (periodo hasta ${dateStr})`,
          meta: { merchantName: e.merchantName },
        })
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))

    return NextResponse.json({
      ok: true,
      from: fromStr,
      to: toStr,
      familyName: family?.name ?? null,
      cutoffDay,
      paid: paid.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        amount: String(t.amount),
        description: t.description,
        registrationCode: t.registrationCode,
        categoryName: t.allocation?.category?.name ?? null,
        entityName: t.allocation?.entity?.name ?? null,
      })),
      upcoming,
      recurring: recurringAll,
      events,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al obtener calendario', 500)
  }
}
