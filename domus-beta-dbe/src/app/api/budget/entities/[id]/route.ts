import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { EntityKind } from '@/generated/prisma/client'
import { entityKindRequiresOwner } from '@/lib/budget/entity-kind-from-body'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede editar entidades', 403)

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const imageUrl =
      body.imageUrl === null
        ? null
        : typeof body.imageUrl === 'string'
          ? body.imageUrl.trim()
            ? body.imageUrl.trim()
            : null
          : undefined
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined
    const participatesInBudget = typeof body.participatesInBudget === 'boolean' ? body.participatesInBudget : undefined
    const participatesInReports = typeof body.participatesInReports === 'boolean' ? body.participatesInReports : undefined
    const subtype =
      body.subtype !== undefined
        ? typeof body.subtype === 'string' && body.subtype.trim()
          ? body.subtype.trim().slice(0, 80)
          : null
        : undefined
    const parentId =
      body.parentId !== undefined
        ? typeof body.parentId === 'string' && body.parentId.trim()
          ? body.parentId.trim()
          : null
        : undefined
    const ownerEntityId =
      body.ownerEntityId !== undefined
        ? typeof body.ownerEntityId === 'string' && body.ownerEntityId.trim()
          ? body.ownerEntityId.trim()
          : null
        : undefined
    const wantsOwnersUpdate = Array.isArray(body.owners)

    if (
      !wantsOwnersUpdate &&
      name === undefined &&
      imageUrl === undefined &&
      isActive === undefined &&
      participatesInBudget === undefined &&
      participatesInReports === undefined &&
      subtype === undefined &&
      parentId === undefined &&
      ownerEntityId === undefined
    )
      return jsonError('Nada que actualizar', 400)

    const existing = await prisma.entity.findUnique({
      where: { id },
      select: { familyId: true, type: true, subtype: true },
    })
    if (!existing) return jsonError('Entidad no encontrada', 404)
    if (existing.familyId !== familyId) return jsonError('No tienes acceso a esta entidad', 403)

    let ownersData: { userId: string; sharePct: number | null }[] | null = null
    if (wantsOwnersUpdate) {
      if (existing.type === EntityKind.PERSON) {
        return jsonError('Los responsables solo aplican a objetos (no Personas)', 400)
      }

      const rows = Array.isArray(body.owners) ? body.owners : []
      ownersData = []
      const seen = new Set<string>()
      for (const r of rows) {
        const userId = typeof r?.userId === 'string' ? r.userId.trim() : ''
        if (!userId) return jsonError('Usuario inválido en responsables', 400)
        if (seen.has(userId)) return jsonError('Responsables duplicados', 400)
        seen.add(userId)

        const rawPct = r?.sharePct
        let sharePct: number | null = null
        if (!(rawPct === undefined || rawPct === null || String(rawPct).trim() === '')) {
          const n = Number(rawPct)
          if (!Number.isFinite(n) || n <= 0 || n > 100) return jsonError('Porcentaje inválido (1-100)', 400)
          sharePct = Math.round(n)
        }

        ownersData.push({ userId, sharePct })
      }

      const ids = ownersData.map((o) => o.userId)
      if (ids.length) {
        const members = await prisma.familyMember.findMany({
          where: { familyId, userId: { in: ids } },
          select: { userId: true },
        })
        const ok = new Set(members.map((m) => String(m.userId)))
        const bad = ids.filter((uid) => !ok.has(uid))
        if (bad.length) return jsonError('Uno o más responsables no pertenecen a la familia', 400)
      }

      const provided = ownersData.filter((o) => o.sharePct !== null)
      if (provided.length > 0) {
        if (provided.length !== ownersData.length) {
          return jsonError('Si defines porcentaje, define para todos los responsables', 400)
        }
        const sum = ownersData.reduce((s, o) => s + (o.sharePct || 0), 0)
        if (sum !== 100) return jsonError('Los porcentajes deben sumar 100', 400)
      } else {
        ownersData = ownersData.map((o) => ({ ...o, sharePct: null }))
      }

      const sub = subtype !== undefined ? subtype : existing.subtype
      if (ownersData.length === 0 && entityKindRequiresOwner(existing.type, sub)) {
        return jsonError(
          'Un activo que requiere responsable o una mascota debe tener al menos un dueño. No puedes dejar la lista vacía.',
          400
        )
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (ownersData !== null) {
        await tx.entityOwner.deleteMany({ where: { entityId: id } })
        if (ownersData.length) {
          await tx.entityOwner.createMany({
            data: ownersData.map((o) => ({
              familyId,
              entityId: id,
              userId: o.userId,
              sharePct: o.sharePct,
            })),
          })
        }
      }

      return tx.entity.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(participatesInBudget !== undefined ? { participatesInBudget } : {}),
          ...(participatesInReports !== undefined ? { participatesInReports } : {}),
          ...(subtype !== undefined ? { subtype } : {}),
          ...(parentId !== undefined ? { parentId } : {}),
          ...(ownerEntityId !== undefined ? { ownerEntityId } : {}),
        },
        select: {
          id: true,
          type: true,
          subtype: true,
          parentId: true,
          ownerEntityId: true,
          name: true,
          imageUrl: true,
          isActive: true,
          participatesInBudget: true,
          participatesInReports: true,
          owners: {
            select: {
              userId: true,
              sharePct: true,
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    })

    return NextResponse.json({ ok: true, entity: updated }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo actualizar la entidad'
    return jsonError(msg, 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede eliminar entidades', 403)

    const { id } = await params
    const entity = await prisma.entity.findUnique({
      where: { id },
      select: { familyId: true, type: true },
    })
    if (!entity) return jsonError('Entidad no encontrada', 404)
    if (entity.familyId !== familyId) return jsonError('No tienes acceso a esta entidad', 403)
    if (entity.type === EntityKind.FAMILY) return jsonError('No se puede eliminar la entidad raíz Familia', 403)

    await prisma.entity.delete({ where: { id } })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo eliminar la entidad'
    return jsonError(msg, 500)
  }
}
