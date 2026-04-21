import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { normalizePhoneForStorage } from '@/lib/whatsapp'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { familyId, userId: requesterId, isFamilyAdmin: requesterIsAdmin } = await requireMembership(req)

    const { userId: targetUserId } = await params
    const body = await req.json().catch(() => ({}))
    const wantsRoleChange = typeof body.isFamilyAdmin === 'boolean'
    const makeAdmin = body.isFamilyAdmin === true
    const nameRaw = typeof body.name === 'string' ? body.name : undefined
    const name = nameRaw !== undefined ? (nameRaw.trim() ? nameRaw.trim() : null) : undefined
    const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : undefined
    const phone = phoneRaw !== undefined
      ? (phoneRaw ? (normalizePhoneForStorage(phoneRaw).replace(/\D/g, '').length >= 12 ? normalizePhoneForStorage(phoneRaw) : phoneRaw) : null)
      : undefined
    const cityRaw = typeof body.city === 'string' ? body.city.trim() : undefined
    const city = cityRaw !== undefined ? (cityRaw || null) : undefined

    const wantsUserUpdate = name !== undefined || phone !== undefined || city !== undefined
    if (!wantsRoleChange && !wantsUserUpdate) return jsonError('Nada que actualizar', 400)

    const isSelf = targetUserId === requesterId
    if (wantsRoleChange && !requesterIsAdmin) return jsonError('Solo el administrador puede cambiar roles', 403)
    if (wantsUserUpdate && !(requesterIsAdmin || isSelf)) return jsonError('Solo el administrador puede editar otros usuarios', 403)

    const membership = await prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId: targetUserId } },
      select: { isFamilyAdmin: true },
    })
    if (!membership) return jsonError('Integrante no encontrado', 404)

    if (wantsRoleChange && makeAdmin === false && membership.isFamilyAdmin) {
      const admins = await prisma.familyMember.count({ where: { familyId, isFamilyAdmin: true } })
      if (admins <= 1) return jsonError('Debe existir al menos un administrador en la familia', 400)
    }

    await prisma.$transaction(async (tx) => {
      if (wantsRoleChange) {
        await tx.familyMember.update({
          where: { familyId_userId: { familyId, userId: targetUserId } },
          data: { isFamilyAdmin: makeAdmin },
        })
      }
      if (wantsUserUpdate) {
        if (phone !== undefined && phone !== null && phone.replace(/\D/g, '').length < 10) {
          throw new Error('El teléfono debe tener al menos 10 dígitos')
        }
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(phone !== undefined ? { phone } : {}),
            ...(city !== undefined ? { city } : {}),
          },
          select: { id: true },
        })
      }
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo actualizar el usuario', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { familyId, userId: requesterId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede eliminar integrantes', 403)

    const { userId: targetUserId } = await params

    // Evitar que el último admin se elimine
    if (targetUserId === requesterId) {
      const admins = await prisma.familyMember.count({
        where: { familyId, isFamilyAdmin: true },
      })
      if (admins <= 1) return jsonError('No puedes eliminar al último administrador de la familia', 400)
    }

    await prisma.familyMember.delete({
      where: { familyId_userId: { familyId, userId: targetUserId } },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo eliminar el integrante', 500)
  }
}

