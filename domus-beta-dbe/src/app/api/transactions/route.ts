import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'

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

    const txs = await prisma.transaction.findMany({
      where: { familyId },
      select: {
        id: true,
        amount: true,
        date: true,
        description: true,
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
      orderBy: { date: 'desc' },
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
    const description = typeof body.description === 'string' ? body.description.trim() : null

    if (!allocationId) return jsonError('Debes elegir una asignación (monto)', 400)
    if (!amount || amount === 0) return jsonError('Monto inválido', 400)
    const date = dateStr ? new Date(dateStr) : new Date()
    if (Number.isNaN(date.getTime())) return jsonError('Fecha inválida', 400)

    const allocation = await prisma.entityBudgetAllocation.findUnique({
      where: { id: allocationId },
      select: { familyId: true },
    })
    if (!allocation) return jsonError('Asignación no encontrada', 404)
    if (allocation.familyId !== familyId) return jsonError('No tienes acceso a esa asignación', 403)

    const created = await prisma.transaction.create({
      data: {
        familyId,
        userId,
        allocationId,
        amount: amount.toString(),
        date,
        description,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true, id: created.id }, { status: 201 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la transacción', 500)
  }
}

