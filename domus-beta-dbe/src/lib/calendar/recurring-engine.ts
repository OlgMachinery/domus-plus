/**
 * Motor IA: detecta pagos recurrentes a partir del historial de transacciones.
 * Agrupa por descripción normalizada + partida, calcula intervalo y día típico, predice próxima fecha.
 */

import { prisma } from '@/lib/db/prisma'

const MIN_OCCURRENCES = 3
const MONTHS_LOOKBACK = 24
const MONTHLY_INTERVAL_MIN = 25
const MONTHLY_INTERVAL_MAX = 45
const AMOUNT_TOLERANCE_PCT = 0.25

function normDesc(desc: string | null): string {
  const s = String(desc ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .replace(/\s+/g, ' ')
  return s.slice(0, 80) || 'sin descripción'
}

function toNum(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type RecurringItem = {
  id: string
  label: string
  descriptionNorm: string
  allocationId: string
  categoryName: string | null
  entityName: string | null
  suggestedAmount: number
  dayOfMonth: number
  intervalDays: number
  lastDate: string
  lastAmount: string
  nextExpectedDate: string
  count: number
  confidence: 'high' | 'medium' | 'low'
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Genera una clave estable para agrupar transacciones recurrentes. */
function recurrenceKey(description: string | null, allocationId: string): string {
  return `${normDesc(description)}|${allocationId}`
}

/**
 * Carga transacciones de la familia en el rango indicado y detecta patrones recurrentes.
 * Devuelve lista de RecurringItem con próxima fecha esperada.
 */
export async function detectRecurringPayments(
  familyId: string,
  options: { monthsLookback?: number } = {},
): Promise<RecurringItem[]> {
  const lookback = options.monthsLookback ?? MONTHS_LOOKBACK
  const to = new Date()
  const from = new Date(to.getFullYear(), to.getMonth() - lookback, 1)

  const txs = await prisma.transaction.findMany({
    where: { familyId, date: { gte: from, lte: to } },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      allocationId: true,
      allocation: {
        select: {
          category: { select: { name: true } },
          entity: { select: { name: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  })

  const byKey = new Map<
    string,
    Array<{ id: string; date: Date; amount: number; description: string | null; allocationId: string; categoryName: string | null; entityName: string | null }>
  >()

  for (const t of txs) {
    const key = recurrenceKey(t.description, t.allocationId)
    const list = byKey.get(key) ?? []
    list.push({
      id: t.id,
      date: t.date,
      amount: toNum(t.amount),
      description: t.description,
      allocationId: t.allocationId,
      categoryName: t.allocation?.category?.name ?? null,
      entityName: t.allocation?.entity?.name ?? null,
    })
    byKey.set(key, list)
  }

  const result: RecurringItem[] = []
  for (const [, list] of byKey) {
    if (list.length < MIN_OCCURRENCES) continue

    const sorted = [...list].sort((a, b) => a.date.getTime() - b.date.getTime())
    const amounts = sorted.map((x) => x.amount).filter((a) => a > 0)
    const medianAmount = median(amounts)
    if (medianAmount <= 0) continue

    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const days = (sorted[i]!.date.getTime() - sorted[i - 1]!.date.getTime()) / (24 * 60 * 60 * 1000)
      intervals.push(days)
    }
    const medianInterval = median(intervals)
    const isMonthly = medianInterval >= MONTHLY_INTERVAL_MIN && medianInterval <= MONTHLY_INTERVAL_MAX
    if (!isMonthly) continue

    const daysOfMonth = sorted.map((x) => x.date.getDate())
    const dayOfMonth = Math.round(median(daysOfMonth))
    const last = sorted[sorted.length - 1]!
    const lastDate = new Date(last.date)
    let nextExpected = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, Math.min(dayOfMonth, 28))
    if (nextExpected <= to) {
      nextExpected = new Date(to.getFullYear(), to.getMonth(), Math.min(dayOfMonth, 28))
      if (nextExpected <= to) nextExpected = new Date(to.getFullYear(), to.getMonth() + 1, Math.min(dayOfMonth, 28))
    }

    const amountVariance = amounts.every((a) => Math.abs(a - medianAmount) / medianAmount <= AMOUNT_TOLERANCE_PCT)
    const confidence: 'high' | 'medium' | 'low' =
      list.length >= 5 && amountVariance ? 'high' : list.length >= 4 ? 'medium' : 'low'

    const label = last.description?.trim() || last.categoryName || 'Pago recurrente'
    result.push({
      id: `recurring-${recurrenceKey(last.description, last.allocationId)}`,
      label: label.slice(0, 60),
      descriptionNorm: normDesc(last.description),
      allocationId: last.allocationId,
      categoryName: last.categoryName,
      entityName: last.entityName,
      suggestedAmount: Math.round(medianAmount * 100) / 100,
      dayOfMonth,
      intervalDays: Math.round(medianInterval),
      lastDate: lastDate.toISOString().slice(0, 10),
      lastAmount: String(last.amount),
      nextExpectedDate: nextExpected.toISOString().slice(0, 10),
      count: list.length,
      confidence,
    })
  }

  return result.sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate))
}

/**
 * Para un rango [from, to], devuelve los pagos esperados (recurrentes) que aún no tienen
 * transacción en ese mes (o en una ventana de ±5 días del día esperado).
 */
export async function getUpcomingExpectedPayments(
  familyId: string,
  from: Date,
  to: Date,
): Promise<RecurringItem[]> {
  const recurring = await detectRecurringPayments(familyId, {})
  const fromStr = from.toISOString().slice(0, 10)
  const toStr = to.toISOString().slice(0, 10)

  const paidInRange = await prisma.transaction.findMany({
    where: { familyId, date: { gte: from, lte: to } },
    select: { id: true, date: true, amount: true, description: true, allocationId: true },
  })

  const paidByKey = new Set<string>()
  for (const t of paidInRange) {
    paidByKey.add(recurrenceKey(t.description, t.allocationId))
  }

  return recurring.filter((r) => {
    if (r.nextExpectedDate < fromStr || r.nextExpectedDate > toStr) return false
    return !paidByKey.has(recurrenceKey(r.descriptionNorm, r.allocationId))
  })
}
