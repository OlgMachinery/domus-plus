import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'

export async function GET(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const mine = req.nextUrl.searchParams.get('mine') === '1'
    if (!mine) {
      const structural = await requireAtLeastOneActiveBudgetObject(familyId)
      if (structural) return structural
    }
    const where: { familyId: string; OR?: { userId: string | null }[] } = { familyId }
    if (mine) where.OR = [{ userId: null }, { userId }]
    const categories = await prisma.budgetCategory.findMany({
      where,
      select: {
        id: true,
        type: true,
        name: true,
        isActive: true,
        code: true,
        parentId: true,
        sortOrder: true,
        userId: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ ok: true, categories }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'EXPENSE'
    const code = typeof body.code === 'string' ? body.code.trim() || null : null
    const parentId = typeof body.parentId === 'string' ? body.parentId.trim() || null : null
    const familyLevel = body.familyLevel === true
    const forUserId = typeof body.userId === 'string' ? body.userId.trim() || null : null
    if (!name) return jsonError('Nombre requerido', 400)

    let createUserId: string | null = null
    if (familyLevel) {
      if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear categorías de familia', 403)
      createUserId = null
    } else if (forUserId && forUserId !== userId) {
      if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear categorías para otro usuario', 403)
      createUserId = forUserId
    } else {
      createUserId = userId
    }

    const created = await prisma.budgetCategory.create({
      data: {
        familyId,
        userId: createUserId,
        name,
        type,
        code: code || undefined,
        parentId: parentId || undefined,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
        isActive: body.isActive !== false,
      },
      select: { id: true, type: true, name: true, isActive: true, code: true, parentId: true, sortOrder: true, userId: true },
    })
    return NextResponse.json({ ok: true, category: created }, { status: 201 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la categoría', 500)
  }
}

