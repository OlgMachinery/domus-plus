import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { hashPassword } from '@/lib/auth/password'
import { setSessionCookie, jsonError } from '@/lib/auth/session'
import { signToken } from '@/lib/auth/jwt'
import { seedDefaultBudgetEntitiesForFamily } from '@/lib/budget/defaults'

function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() : null
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null
    const familyNameInput = typeof body.familyName === 'string' ? body.familyName.trim() : ''

    if (!email || !email.includes('@') || !password) return jsonError('Email y contraseña son requeridos', 400)
    if (password.length < 6) return jsonError('La contraseña debe tener al menos 6 caracteres', 400)

    const passwordHash = await hashPassword(password)

    const familyName =
      familyNameInput ||
      (name ? `Familia de ${name}` : `Familia de ${email.split('@')[0] || 'Usuario'}`)

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          phone,
        },
        select: { id: true, email: true, name: true },
      })
      const family = await tx.family.create({
        data: {
          name: familyName,
          budgetStartDate: monthStart(),
        },
        select: { id: true, name: true },
      })
      await tx.familyMember.create({
        data: {
          familyId: family.id,
          userId: user.id,
          isFamilyAdmin: true,
        },
      })
      const seeded = await seedDefaultBudgetEntitiesForFamily(tx, family.id)
      return { user, family, seeded }
    })

    const token = await signToken({ userId: result.user.id, familyId: result.family.id })
    const res = NextResponse.json(
      { ok: true, user: result.user, family: result.family, defaultObjectsCreated: result.seeded.created },
      { status: 201 }
    )
    setSessionCookie(req, res, token)
    return res
  } catch (e: any) {
    // Email duplicado
    if (e?.code === 'P2002') return jsonError('El email ya está registrado', 400)
    return jsonError('No se pudo crear la cuenta', 500)
  }
}

