import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'
import { generateRegistrationCode } from '@/lib/registration-code'
import { findPossibleDuplicate } from '@/lib/dedup'
import { containsSensitiveData } from '@/lib/sensitive'
import { mapBudgetAccountToLegacyAllocationShape } from '@/lib/budget/transaction-allocation-compat'

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

export async function GET(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const mine = req.nextUrl.searchParams.get('mine') === '1'
    const takeParam = req.nextUrl.searchParams.get('take')
    let take: number | undefined
    if (takeParam) {
      const n = Number(takeParam)
      if (Number.isInteger(n) && n > 0 && n <= 5000) take = n
    }
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')
    const dateFilter: { date?: { gte?: Date; lte?: Date } } = {}
    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      dateFilter.date = { ...dateFilter.date, gte: new Date(fromParam + 'T00:00:00.000Z') }
    }
    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      dateFilter.date = { ...dateFilter.date, lte: new Date(toParam + 'T23:59:59.999Z') }
    }

    const txs = await prisma.transaction.findMany({
      where: { familyId, ...(mine ? { userId } : {}), ...(Object.keys(dateFilter).length ? dateFilter : {}) },
      select: {
        id: true,
        amount: true,
        date: true,
        description: true,
        registrationCode: true,
        pendingReason: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        budgetAccount: {
          select: {
            id: true,
            entity: { select: { id: true, name: true, type: true } },
            service: { select: { id: true, name: true } },
          },
        },
        receipts: { select: { id: true, fileUrl: true, createdAt: true, extraction: { select: { id: true, confirmedAt: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      ...(take ? { take } : {}),
    })

    return NextResponse.json(
      {
        ok: true,
        transactions: txs.map((t) => ({
          id: t.id,
          amount: t.amount.toString(),
          date: t.date.toISOString(),
          createdAt: t.createdAt.toISOString(),
          description: t.description,
          registrationCode: t.registrationCode ?? null,
          pendingReason: t.pendingReason ?? null,
          user: t.user,
          budgetAccount: t.budgetAccount,
          allocation: t.budgetAccount
            ? mapBudgetAccountToLegacyAllocationShape({
                id: t.budgetAccount.id,
                entity: t.budgetAccount.entity,
                service: t.budgetAccount.service,
              })
            : null,
          receipts: t.receipts.map((r) => ({
            id: r.id,
            fileUrl: r.fileUrl,
            createdAt: r.createdAt.toISOString(),
            extraction: r.extraction
              ? {
                  id: r.extraction.id,
                  confirmedAt: r.extraction.confirmedAt ? r.extraction.confirmedAt.toISOString() : null,
                }
              : null,
          })),
        })),
      },
      { status: 200 }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autenticado'
    return jsonError(msg, 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural
    const body = await req.json().catch(() => ({}))

    const budgetAccountId =
      (typeof body.budgetAccountId === 'string' ? body.budgetAccountId : '') ||
      (typeof body.allocationId === 'string' ? body.allocationId : '')
    const amount = toNumber(body.amount)
    const dateStr = typeof body.date === 'string' ? body.date : ''
    let description = typeof body.description === 'string' ? body.description.trim() : null

    if (!budgetAccountId) return jsonError('Debes elegir una cuenta de presupuesto (destino)', 400)
    if (!amount || amount === 0) return jsonError('Monto inválido', 400)
    const date = dateStr ? new Date(dateStr) : new Date()
    if (Number.isNaN(date.getTime())) return jsonError('Fecha inválida', 400)

    let sensitiveWarning: string | null = null
    if (description && containsSensitiveData(description)) {
      sensitiveWarning = 'No guardamos datos sensibles (tarjetas, contraseñas). La descripción fue omitida.'
      description = null
    }

    const account = await prisma.budgetAccount.findUnique({
      where: { id: budgetAccountId },
      select: { familyId: true, isActive: true },
    })
    if (!account) return jsonError('Cuenta de presupuesto no encontrada', 404)
    if (account.familyId !== familyId) return jsonError('No tienes acceso a esa cuenta', 403)
    if (!account.isActive) return jsonError('La cuenta de presupuesto está inactiva', 400)

    const registrationCode = await generateRegistrationCode(prisma, familyId, 'E')
    const created = await prisma.transaction.create({
      data: {
        familyId,
        userId,
        budgetAccountId,
        amount: amount.toString(),
        date,
        description,
        registrationCode,
        source: 'manual',
        sourceChannel: 'app',
      },
      select: { id: true, registrationCode: true },
    })

    const duplicateWarning = await findPossibleDuplicate(prisma, familyId, {
      amount,
      date,
      descriptionOrMerchant: description,
      excludeTransactionId: created.id,
    })

    return NextResponse.json(
      {
        ok: true,
        id: created.id,
        registrationCode: created.registrationCode,
        ...(sensitiveWarning && { sensitiveWarning }),
        ...(duplicateWarning && { duplicateWarning }),
      },
      { status: 201 }
    )
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo crear la transacción'
    return jsonError(msg, 500)
  }
}
