import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

/** Catálogo global de servicios (solo lectura; sin creación desde UI). */
export async function GET(req: NextRequest) {
  try {
    await requireMembership(req)
    const services = await prisma.service.findMany({
      where: { isActive: true },
      select: { id: true, name: true, categoryGroup: true },
      orderBy: [{ categoryGroup: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ ok: true, services }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autenticado'
    return jsonError(msg, 401)
  }
}
