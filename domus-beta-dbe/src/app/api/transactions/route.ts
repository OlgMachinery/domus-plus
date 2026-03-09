import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'
import { generateRegistrationCode } from '@/lib/registration-code'
import { findPossibleDuplicate } from '@/lib/dedup'
import { containsSensitiveData } from '@/lib/sensitive'

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return n
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const takeParam = req.nextUrl.searchParams.get('take')
    let take: number | undefined
    if (takeParam) {
      const n = Number(takeParam)
      if (Number.isInteger(n) && n > 0 && n <= 5000) take = n
    }
    const fromParam = req.nextUrl.searchParams.get('from') // YYYY-MM-DD
    const toParam = req.nextUrl.searchParams.get('to') // YYYY-MM-DD
    const dateFilter: { date?: { gte?: Date; lte?: Date } } = {}
    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      dateFilter.date = { ...dateFilter.date, gte: new Date(fromParam + 'T00:00:00.000Z') }
    }
    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      dateFilter.date = { ...dateFilter.date, lte: new Date(toParam + 'T23:59:59.999Z') }
    }

    const txs = await prisma.transaction.findMany({
      where: { familyId, ...(Object.keys(dateFilter).length ? dateFilter : {}) },
      select: {
        id: true,
        amount: true,
        date: true,
        description: true,
        registrationCode: true,
        pendingReason: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        allocation: {
          select: {
            id: true,
            entity: { select: { id: true, name: true, type: true } },
            category: { select: { id: true, name: true, type: true } },
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
          allocation: t.allocation,
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
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural
    const body = await req.json().catch(() => ({}))

    const allocationId = typeof body.allocationId === 'string' ? body.allocationId : ''
    const amount = toNumber(body.amount)
    const dateStr = typeof body.date === 'string' ? body.date : ''
    let description = typeof body.description === 'string' ? body.description.trim() : null

    if (!allocationId) return jsonError('Debes elegir una asignación (monto)', 400)
    if (!amount || amount === 0) return jsonError('Monto inválido', 400)
    const date = dateStr ? new Date(dateStr) : new Date()
    if (Number.isNaN(date.getTime())) return jsonError('Fecha inválida', 400)

    let sensitiveWarning: string | null = null
    if (description && containsSensitiveData(description)) {
      sensitiveWarning = 'No guardamos datos sensibles (tarjetas, contraseñas). La descripción fue omitida.'
      description = null
    }

    const allocation = await prisma.entityBudgetAllocation.findUnique({
      where: { id: allocationId },
      select: { familyId: true },
    })
    if (!allocation) return jsonError('Asignación no encontrada', 404)
    if (allocation.familyId !== familyId) return jsonError('No tienes acceso a esa asignación', 403)

    const registrationCode = await generateRegistrationCode(prisma, familyId, 'E')
    const created = await prisma.transaction.create({
      data: {
        familyId,
        userId,
        allocationId,
        amount: amount.toString(),
        date,
        description,
        registrationCode,
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
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la transacción', 500)
  }
}

