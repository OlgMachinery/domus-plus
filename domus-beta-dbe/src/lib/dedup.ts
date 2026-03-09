/**
 * Detección de posibles duplicados al crear transacciones.
 * B2: Avisar sin bloquear.
 */

import type { PrismaClient } from '@/generated/prisma/client'

const AMOUNT_TOLERANCE_PCT = 0.08 // ±8% (recibos iguales pueden variar por OCR)
const AMOUNT_TOLERANCE_ABS = 10 // ±10 pesos
const DAYS_LOOKBACK = 30 // ventana amplia para detectar duplicados (mismo recibo subido otra vez)
const DAYS_FORWARD = 3
const MAX_CANDIDATES = 50

export type DuplicateWarning = {
  transactionId: string
  date: string
  description: string | null
  amount: string
}

/**
 * Busca transacciones recientes de la familia que podrían ser la misma (monto y fecha cercanos).
 * Comparación de monto en JS para evitar fallos con Decimal almacenado como texto en SQLite.
 * Opcional: excludeTransactionId para no devolver la transacción recién creada.
 */
export async function findPossibleDuplicate(
  prisma: PrismaClient,
  familyId: string,
  args: { amount: number; date: Date; descriptionOrMerchant: string | null; excludeTransactionId?: string }
): Promise<DuplicateWarning | null> {
  const { amount, date, descriptionOrMerchant, excludeTransactionId } = args
  if (!amount || !Number.isFinite(amount)) return null

  const from = new Date(date)
  from.setDate(from.getDate() - DAYS_LOOKBACK)
  const to = new Date(date)
  to.setDate(to.getDate() + DAYS_FORWARD)

  const tolerance = Math.max(AMOUNT_TOLERANCE_ABS, amount * AMOUNT_TOLERANCE_PCT)
  const minAmount = amount - tolerance
  const maxAmount = amount + tolerance

  const byDate = await prisma.transaction.findMany({
    where: {
      familyId,
      ...(excludeTransactionId && { id: { not: excludeTransactionId } }),
      date: { gte: from, lte: to },
    },
    select: { id: true, date: true, description: true, amount: true },
    orderBy: { date: 'desc' },
    take: MAX_CANDIDATES,
  })

  const candidates = byDate.filter((t) => {
    const num = Number(t.amount)
    return Number.isFinite(num) && num >= minAmount && num <= maxAmount
  })

  // Si hay descripción/comercio, preferir candidato con descripción similar (contiene o está contenido)
  const descNorm = (descriptionOrMerchant || '').trim().toLowerCase().slice(0, 80)
  let best = candidates[0] ?? null
  if (descNorm.length >= 3 && candidates.length > 1) {
    const withDesc = candidates.find((c) => {
      const d = (c.description || '').toLowerCase()
      return d.includes(descNorm) || descNorm.includes(d)
    })
    if (withDesc) best = withDesc
  }

  if (!best) return null
  return {
    transactionId: best.id,
    date: best.date.toISOString().slice(0, 10),
    description: best.description,
    amount: String(best.amount),
  }
}
