import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth, setSessionCookie } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { seedDefaultBudgetEntitiesForFamily } from '@/lib/budget/defaults'

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      select: { isFamilyAdmin: true, family: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({
      ok: true,
      families: memberships.map((m) => ({
        id: m.family.id,
        name: m.family.name,
        isFamilyAdmin: m.isFamilyAdmin,
      })),
    })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return jsonError('El nombre de la familia es requerido', 400)

    const { family, seeded } = await prisma.$transaction(async (tx) => {
      const family = await tx.family.create({
        data: { name, budgetStartDate: monthStart() },
        select: { id: true, name: true },
      })
      await tx.familyMember.create({
        data: { familyId: family.id, userId, isFamilyAdmin: true },
      })
      const seeded = await seedDefaultBudgetEntitiesForFamily(tx, family.id)
      return { family, seeded }
    })

    // La nueva familia queda como “activa” (se emite token nuevo)
    const token = await signToken({ userId, familyId: family.id })
    const res = NextResponse.json({ ok: true, family, defaultObjectsCreated: seeded.created }, { status: 201 })
    setSessionCookie(req, res, token)
    return res
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

