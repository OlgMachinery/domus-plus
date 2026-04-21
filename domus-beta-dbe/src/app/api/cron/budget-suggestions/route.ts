import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * C4: Cron de sugerencias automáticas de presupuesto.
 * Por familia: revisa gasto del mes por partida vs límite; si se supera, crea BudgetAdjustmentSuggestion (CHANGE_LIMIT) PENDING.
 * Llamar con ?secret=CRON_SECRET (o header x-cron-secret).
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET
  if (expected && secret !== expected) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const families = await prisma.family.findMany({
    select: { id: true },
  })

  let created = 0
  for (const family of families) {
    const allocations = await prisma.budgetAccount.findMany({
      where: { familyId: family.id, isActive: true, monthlyLimit: { gt: 0 } },
      select: {
        id: true,
        monthlyLimit: true,
        service: { select: { name: true } },
        entity: { select: { name: true } },
      },
    })

    for (const alloc of allocations) {
      const limit = Number(alloc.monthlyLimit) || 0
      if (limit <= 0) continue

      const txSum = await prisma.transaction.aggregate({
        where: {
          familyId: family.id,
          budgetAccountId: alloc.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      })
      const spent = Number(txSum._sum?.amount ?? 0) || 0
      if (spent < limit * 0.9) continue

      const pendingSame = await prisma.budgetAdjustmentSuggestion.findMany({
        where: { familyId: family.id, status: 'PENDING', type: 'CHANGE_LIMIT' },
        select: { payload: true },
      })
      const alreadySuggested = pendingSame.some((p) => {
        try {
          const pl = JSON.parse(p.payload) as { allocationId?: string; budgetAccountId?: string }
          const aid = pl.budgetAccountId ?? pl.allocationId
          return aid === alloc.id
        } catch {
          return false
        }
      })
      if (alreadySuggested) continue

      const member = await prisma.familyMember.findFirst({
        where: { familyId: family.id },
        select: { userId: true },
      })
      if (!member) continue
      const payload = {
        budgetAccountId: alloc.id,
        allocationId: alloc.id,
        categoryName: alloc.service?.name ?? null,
        entityName: alloc.entity?.name ?? null,
        currentLimit: limit,
        currentSpend: spent,
        suggestedNewLimit: Math.ceil(spent * 1.1),
        text: `Gasto del mes ($${spent}) alcanzó o superó el límite ($${limit}) en ${alloc.service?.name ?? '—'} / ${alloc.entity?.name ?? '—'}.`,
      }
      await prisma.budgetAdjustmentSuggestion.create({
        data: {
          familyId: family.id,
          userId: member.userId,
          type: 'CHANGE_LIMIT',
          payload: JSON.stringify(payload),
          status: 'PENDING',
        },
      })
      created++
    }
  }

  return NextResponse.json({ ok: true, created, familiesProcessed: families.length })
}
