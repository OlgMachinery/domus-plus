import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { PARTIDAS_TEMPLATE } from '@/lib/budget/partidas-template'

/**
 * POST: Crear las partidas de la plantilla (6xxx-9xxx) para el usuario actual.
 * Cada usuario puede tener su propio entorno de partidas (userId en BudgetCategory).
 * Si ya tiene partidas con código, no se duplican.
 */
export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)

    const existing = await prisma.budgetCategory.findMany({
      where: { familyId, userId, code: { not: null } },
      select: { code: true },
    })
    const existingCodes = new Set((existing || []).map((c) => c.code).filter(Boolean) as string[])
    if (existingCodes.size >= PARTIDAS_TEMPLATE.length) {
      return NextResponse.json({
        ok: true,
        message: 'Ya tienes las partidas creadas.',
        count: existingCodes.size,
      })
    }

    const codeToId: Record<string, string> = {}
    let createdCount = 0
    for (let i = 0; i < PARTIDAS_TEMPLATE.length; i++) {
      const p = PARTIDAS_TEMPLATE[i]
      if (existingCodes.has(p.code)) {
        const existingCat = await prisma.budgetCategory.findFirst({
          where: { familyId, userId, code: p.code },
          select: { id: true },
        })
        if (existingCat) codeToId[p.code] = existingCat.id
        continue
      }
      const parentId = p.parentCode ? codeToId[p.parentCode] ?? null : null
      const created = await prisma.budgetCategory.create({
        data: {
          familyId,
          userId,
          type: 'EXPENSE',
          name: p.name,
          code: p.code,
          parentId: parentId || undefined,
          sortOrder: i,
          isActive: true,
        },
        select: { id: true, code: true },
      })
      if (created.code) codeToId[created.code] = created.id
      createdCount++
    }

    const total = await prisma.budgetCategory.count({ where: { familyId, userId, code: { not: null } } })
    return NextResponse.json({
      ok: true,
      message: createdCount > 0 ? `Partidas de tu entorno creadas (${createdCount} nuevas, ${total} en total).` : 'Ya tienes todas las partidas.',
      count: total,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudieron crear las partidas', 500)
  }
}
