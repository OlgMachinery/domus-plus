import { NextRequest, NextResponse } from 'next/server'
import { requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/setup/onboarding-status
 * Devuelve si la familia tiene ya partidas/categorías y si el usuario puede ver el onboarding (admin).
 */
export async function GET(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!familyId) {
      return NextResponse.json({
        ok: true,
        canShowOnboarding: false,
        hasFamily: false,
        isAdmin: false,
        entityCount: 0,
        categoryCount: 0,
      })
    }

    const [entityCount, categoryCount] = await Promise.all([
      prisma.entity.count({ where: { familyId, isActive: true } }),
      prisma.budgetCategory.count({ where: { familyId, isActive: true } }),
    ])

    const hasEntities = entityCount >= 1
    const hasCategories = categoryCount >= 1
    const canShowOnboarding = isFamilyAdmin

    return NextResponse.json({
      ok: true,
      canShowOnboarding,
      hasFamily: true,
      isAdmin: isFamilyAdmin,
      hasEntities,
      hasCategories,
      entityCount,
      categoryCount,
    })
  } catch {
    return NextResponse.json({
      ok: true,
      canShowOnboarding: false,
      hasFamily: false,
      isAdmin: false,
      entityCount: 0,
      categoryCount: 0,
    })
  }
}
