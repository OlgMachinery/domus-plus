import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { requireAtLeastOneActiveBudgetObject } from '@/lib/budget/structural'

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural
    const categories = await prisma.budgetCategory.findMany({
      where: { familyId },
      select: { id: true, type: true, name: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ ok: true, categories }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear categorías', 403)
    const structural = await requireAtLeastOneActiveBudgetObject(familyId)
    if (structural) return structural

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'EXPENSE'
    if (!name) return jsonError('Nombre requerido', 400)

    const created = await prisma.budgetCategory.create({
      data: { familyId, name, type, isActive: body.isActive !== false },
      select: { id: true, type: true, name: true, isActive: true },
    })
    return NextResponse.json({ ok: true, category: created }, { status: 201 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la categoría', 500)
  }
}

