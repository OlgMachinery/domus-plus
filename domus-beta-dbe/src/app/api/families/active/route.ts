import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership, setSessionCookie } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { signToken } from '@/lib/auth/jwt'
import { verifyPassword } from '@/lib/auth/password'

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: {
        id: true,
        name: true,
        currency: true,
        cutoffDay: true,
        budgetStartDate: true,
        setupComplete: true,
        planStatus: true,
      },
    })
    if (!family) return jsonError('Familia no encontrada', 404)
    return NextResponse.json({ ok: true, family }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede editar la familia', 403)

    const body = await req.json().catch(() => ({}))

    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : undefined
    const cutoffDayRaw = body.cutoffDay
    const cutoffDay = cutoffDayRaw !== undefined ? Number(cutoffDayRaw) : undefined
    const budgetStartDateRaw = typeof body.budgetStartDate === 'string' ? body.budgetStartDate : undefined

    if (name !== undefined && !name) return jsonError('Nombre requerido', 400)
    if (currency !== undefined && (!currency || currency.length < 3 || currency.length > 6)) return jsonError('Moneda inválida', 400)
    if (cutoffDay !== undefined) {
      if (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 28) return jsonError('cutoffDay debe ser un entero entre 1 y 28', 400)
    }

    let budgetStartDate: Date | undefined
    if (budgetStartDateRaw !== undefined) {
      const d = new Date(budgetStartDateRaw)
      if (Number.isNaN(d.getTime())) return jsonError('Fecha inválida (budgetStartDate)', 400)
      budgetStartDate = d
    }

    if (name === undefined && currency === undefined && cutoffDay === undefined && budgetStartDate === undefined) {
      return jsonError('Nada que actualizar', 400)
    }

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(currency !== undefined ? { currency } : {}),
        ...(cutoffDay !== undefined ? { cutoffDay } : {}),
        ...(budgetStartDate !== undefined ? { budgetStartDate } : {}),
      },
      select: {
        id: true,
        name: true,
        currency: true,
        cutoffDay: true,
        budgetStartDate: true,
        setupComplete: true,
        planStatus: true,
      },
    })

    return NextResponse.json({ ok: true, family: updated }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo editar la familia', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede eliminar la familia', 403)

    const body = (await req.json().catch(() => ({}))) as any
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const archiveId = typeof body.archiveId === 'string' ? body.archiveId : ''
    if (!email || !password) return jsonError('Usuario y contraseña son requeridos', 400)
    if (!archiveId) return jsonError('Antes de eliminar, primero descarga el respaldo.', 400)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    })
    if (!user) return jsonError('No autenticado', 401)
    if (String(user.email || '').trim().toLowerCase() !== email) return jsonError('Credenciales inválidas', 400)
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return jsonError('Credenciales inválidas', 400)

    const archive = await prisma.deletionArchive.findUnique({
      where: { id: archiveId },
      select: { id: true, kind: true, familyId: true, createdByUserId: true, createdAt: true },
    })
    if (!archive) return jsonError('Respaldo inválido. Genera uno nuevo.', 400)
    if (archive.kind !== 'family') return jsonError('Respaldo inválido (tipo). Genera uno nuevo.', 400)
    if (archive.familyId !== familyId) return jsonError('El respaldo no corresponde a la familia activa.', 400)
    if (archive.createdByUserId !== userId) return jsonError('El respaldo no corresponde a tu sesión.', 403)

    const ageMs = Date.now() - new Date(archive.createdAt).getTime()
    if (ageMs > 1000 * 60 * 30) return jsonError('El respaldo expiró. Genera uno nuevo e intenta de nuevo.', 400)

    const now = new Date()
    await prisma.$transaction(async (tx) => {
      // Orden importante para evitar FK restrict (transactions -> receipts, transactions -> allocation).
      // Borramos primero todo lo “colgado” de recibos/extracciones para evitar dependencias que no tengan CASCADE en DB.
      await tx.receiptExtractionItem.deleteMany({ where: { extraction: { familyId } } })
      await tx.receiptExtraction.deleteMany({ where: { familyId } })
      await tx.receiptImage.deleteMany({ where: { receipt: { familyId } } })
      await tx.receipt.deleteMany({ where: { familyId } })

      await tx.moneyRequest.deleteMany({ where: { familyId } })
      await tx.userBudgetSubdivision.deleteMany({ where: { familyId } })
      await tx.transaction.deleteMany({ where: { familyId } })
      await tx.budgetAccount.deleteMany({ where: { familyId } })
      await tx.entityService.deleteMany({ where: { familyId } })
      await tx.userEntityPermission.deleteMany({ where: { familyId } })
      await tx.entityOwner.deleteMany({ where: { familyId } })
      await tx.entity.deleteMany({ where: { familyId } })
      await tx.budgetCategory.deleteMany({ where: { familyId } })
      await tx.familyMember.deleteMany({ where: { familyId } })
      await tx.family.delete({ where: { id: familyId } })

      await tx.deletionArchive.update({
        where: { id: archiveId },
        data: { deletedAt: now, deletedByUserId: userId },
      })
    })

    // Elegir nueva familia activa (si existe) y emitir token nuevo
    const memberships = await prisma.familyMember.findMany({
      where: { userId },
      select: { familyId: true },
      orderBy: { createdAt: 'desc' },
    })
    const nextFamilyId = memberships[0]?.familyId ?? null

    const token = await signToken({ userId, familyId: nextFamilyId })
    const res = NextResponse.json({ ok: true, activeFamilyId: nextFamilyId }, { status: 200 })
    setSessionCookie(req, res, token)
    return res
  } catch (e: any) {
    const msg = e?.message || 'No se pudo eliminar la familia'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

