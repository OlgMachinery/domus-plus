import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede confirmar el plan', 403)

    const activeEntityCount = await prisma.entity.count({
      where: { familyId, isActive: true },
    })
    const categoryCount = await prisma.budgetCategory.count({
      where: { familyId, isActive: true },
    })
    const allocationCount = await prisma.budgetAccount.count({
      where: { familyId, isActive: true, monthlyLimit: { gt: 0 } },
    })

    if (activeEntityCount < 1) return jsonError('Necesitas al menos 1 objeto presupuestal activo', 400)
    if (categoryCount < 1) return jsonError('Necesitas al menos 1 categoría activa', 400)
    if (allocationCount < 1) return jsonError('Necesitas al menos 1 asignación con monto mayor a 0', 400)

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: { setupComplete: true, planStatus: 'CONFIRMED' },
      select: { id: true, setupComplete: true, planStatus: true },
    })

    return NextResponse.json({ ok: true, family: updated }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo confirmar el plan', 500)
  }
}

