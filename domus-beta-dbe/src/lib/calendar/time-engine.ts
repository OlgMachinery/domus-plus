/**
 * DOMUS Time Engine: agrega eventos de todos los módulos en una lista unificada.
 * Cada evento incluye source_table y source_id para navegar al registro original.
 */

import { prisma } from '@/lib/db/prisma'
import { getUpcomingExpectedPayments } from './recurring-engine'

/**
 * Tipos de evento usados en el calendario (colores en calendar-fullcalendar.css):
 * Financieros: payment, payment_expected, cutoff, utility_reminder, money_request, money_delivered, budget_suggestion.
 * No financieros: birthday, appointment, reminder, vacation, custom.
 */
export type TimeEngineEvent = {
  id: string
  type: string
  title: string
  date: string
  amount?: number
  status?: string
  source_table: string
  source_id: string | null
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function evtId(prefix: string, sourceId: string | null, fallback: string): string {
  if (sourceId) return `evt_${prefix}_${sourceId}`
  return `evt_${fallback}`
}

/**
 * Construye la lista unificada de eventos para el rango [from, to].
 */
export async function getCalendarEvents(
  familyId: string,
  from: Date,
  to: Date,
): Promise<{ events: TimeEngineEvent[]; familyName: string | null; cutoffDay: number }> {
  const fromStr = from.toISOString().slice(0, 10)
  const toStr = to.toISOString().slice(0, 10)

  const [family, paid, upcoming, moneyRequests, extractionsUtility, familyCalendarEvents] = await Promise.all([
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
        budgetAccount: { select: { service: { select: { name: true } }, entity: { select: { name: true } } } },
      },
      orderBy: { date: 'asc' },
    }),
    getUpcomingExpectedPayments(familyId, from, to),
    prisma.moneyRequest.findMany({
      where: {
        familyId,
        OR: [
          { requestedAt: { gte: from, lte: to } },
          { deliveredAt: { gte: from, lte: to } },
        ],
      },
      select: { id: true, amount: true, reason: true, status: true, requestedAt: true, deliveredAt: true },
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
    prisma.familyCalendarEvent.findMany({
      where: { familyId, eventDate: { gte: from, lte: to } },
      select: { id: true, title: true, eventDate: true, type: true },
      orderBy: { eventDate: 'asc' },
    }),
  ])

  const events: TimeEngineEvent[] = []

  for (const t of paid) {
    const dateStr = t.date.toISOString().slice(0, 10)
    events.push({
      id: evtId('tx', t.id, t.id),
      type: 'payment',
      title: t.description || t.budgetAccount?.service?.name || 'Gasto',
      date: dateStr,
      amount: Number(t.amount),
      status: 'completed',
      source_table: 'transaction',
      source_id: t.id,
    })
  }

  for (const u of upcoming) {
    events.push({
      id: evtId('recurring', u.id, u.nextExpectedDate + '_' + (u.label || '').slice(0, 20)),
      type: 'payment_expected',
      title: u.label,
      date: u.nextExpectedDate,
      amount: u.suggestedAmount,
      status: 'pending',
      source_table: 'recurring_inferred',
      source_id: u.id,
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
        const dateStr = cutoffDate.toISOString().slice(0, 10)
        events.push({
          id: evtId('cutoff', null, dateStr),
          type: 'cutoff',
          title: 'Cierre presupuestal',
          date: dateStr,
          status: 'scheduled',
          source_table: 'family',
          source_id: null,
        })
      }
    }
  }

  for (const mr of moneyRequests) {
    if (mr.requestedAt >= from && mr.requestedAt <= to) {
      events.push({
        id: evtId('money_request', mr.id, mr.id + '_req'),
        type: 'money_request',
        title: `Solicitud: ${mr.reason || 'efectivo'}`,
        date: mr.requestedAt.toISOString().slice(0, 10),
        amount: Number(mr.amount),
        status: mr.status ?? 'pending',
        source_table: 'money_request',
        source_id: mr.id,
      })
    }
    if (mr.deliveredAt && mr.deliveredAt >= from && mr.deliveredAt <= to) {
      events.push({
        id: evtId('money_request', mr.id, mr.id + '_del'),
        type: 'money_delivered',
        title: `Entrega efectivo: ${mr.reason || '—'}`,
        date: mr.deliveredAt.toISOString().slice(0, 10),
        amount: Number(mr.amount),
        status: 'delivered',
        source_table: 'money_request',
        source_id: mr.id,
      })
    }
  }

  for (const e of extractionsUtility) {
    if (!e.consumptionPeriodEnd) continue
    const dateStr = e.consumptionPeriodEnd.toISOString().slice(0, 10)
    if (dateStr >= fromStr && dateStr <= toStr) {
      const unit = String(e.consumptionUnit || '').toLowerCase().replace(/\s/g, '') === 'm3' ? 'Agua' : 'Luz'
      events.push({
        id: evtId('receipt_extraction', e.receiptId, e.receiptId),
        type: 'utility_reminder',
        title: `Factura ${unit} (periodo hasta ${dateStr})`,
        date: dateStr,
        status: 'scheduled',
        source_table: 'receipt_extraction',
        source_id: e.receiptId,
      })
    }
  }

  for (const fe of familyCalendarEvents) {
    const dateStr = fe.eventDate.toISOString().slice(0, 10)
    const type = ['birthday', 'appointment', 'reminder', 'vacation', 'custom'].includes(fe.type) ? fe.type : 'custom'
    events.push({
      id: evtId('family_evt', fe.id, fe.id),
      type,
      title: fe.title,
      date: dateStr,
      status: 'scheduled',
      source_table: 'family_calendar_event',
      source_id: fe.id,
    })
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))

  return {
    events,
    familyName: family?.name ?? null,
    cutoffDay,
  }
}
