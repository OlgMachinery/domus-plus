import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { EntityKind } from '@/generated/prisma/client'
import { entityKindAndSubtypeFromBody, entityKindRequiresOwner } from '@/lib/budget/entity-kind-from-body'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl } from '@/lib/storage/spaces'
import { ensureFamilyRootEntity } from '@/lib/budget/ensure-family-root-entity'

async function signIfSpaces(fileUrl: unknown) {
  const raw = typeof fileUrl === 'string' ? fileUrl.trim() : ''
  if (!raw) return null
  const key = extractKeyFromSpacesUrl(raw)
  if (!key) return raw
  try {
    return await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 10 })
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const mine = req.nextUrl.searchParams.get('mine') === '1'
    const where: { familyId: string; id?: { in: string[] } } = { familyId }
    if (mine) {
      const owned = await prisma.entityOwner.findMany({
        where: { familyId, userId },
        select: { entityId: true },
      })
      const ids = owned.map((o) => o.entityId)
      if (ids.length === 0) {
        return NextResponse.json({ ok: true, entities: [] }, { status: 200 })
      }
      where.id = { in: ids }
    }
    const entities = await prisma.entity.findMany({
      where,
      select: {
        id: true,
        type: true,
        subtype: true,
        parentId: true,
        ownerEntityId: true,
        customTypeId: true,
        customType: { select: { id: true, name: true } },
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
      orderBy: { createdAt: 'asc' },
    })
    const withSigned = await Promise.all(
      entities.map(async (e) => ({
        ...e,
        imageSignedUrl: await signIfSpaces((e as { imageUrl?: string | null })?.imageUrl),
      }))
    )
    return NextResponse.json({ ok: true, entities: withSigned }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No autenticado'
    return jsonError(msg, 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear entidades', 403)

    const body = await req.json().catch(() => ({}))
    const customTypeId = typeof body.customTypeId === 'string' && body.customTypeId.trim() ? body.customTypeId.trim() : null
    const subtypeBody =
      typeof body.subtype === 'string' && body.subtype.trim() ? body.subtype.trim().slice(0, 80) : null
    const parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null
    const ownerEntityId =
      typeof body.ownerEntityId === 'string' && body.ownerEntityId.trim() ? body.ownerEntityId.trim() : null

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const participatesInBudget = body.participatesInBudget !== false
    const participatesInReports = body.participatesInReports !== false

    let kind: EntityKind
    let subtype: string | null
    if (customTypeId) {
      const exists = await prisma.familyEntityType.findFirst({ where: { id: customTypeId, familyId } })
      if (!exists) return jsonError('Tipo personalizado no encontrado', 400)
      kind = EntityKind.ASSET
      subtype = subtypeBody
    } else {
      const hasType = typeof body.type === 'string' && body.type.trim() !== ''
      if (!hasType) return jsonError('Tipo inválido', 400)
      const parsed = entityKindAndSubtypeFromBody(body.type, null)
      kind = parsed.kind
      subtype = subtypeBody ?? parsed.subtype
    }
    if (!name) return jsonError('Nombre requerido', 400)

    const ownersBody = Array.isArray((body as { owners?: unknown }).owners) ? (body as { owners: unknown[] }).owners : []
    type Row = { userId: string; sharePct: number | null }
    const ownersRows: Row[] = []
    const seen = new Set<string>()
    for (const r of ownersBody) {
      const userId = typeof (r as { userId?: string })?.userId === 'string' ? (r as { userId: string }).userId.trim() : ''
      if (!userId) return jsonError('Usuario inválido en responsables', 400)
      if (seen.has(userId)) return jsonError('Responsables duplicados', 400)
      seen.add(userId)
      const rawPct = (r as { sharePct?: unknown })?.sharePct
      let sharePct: number | null = null
      if (!(rawPct === undefined || rawPct === null || String(rawPct).trim() === '')) {
        const n = Number(rawPct)
        if (!Number.isFinite(n) || n <= 0 || n > 100) return jsonError('Porcentaje inválido (1-100)', 400)
        sharePct = Math.round(n)
      }
      ownersRows.push({ userId, sharePct })
    }
    const provided = ownersRows.filter((o) => o.sharePct !== null)
    if (provided.length > 0) {
      if (provided.length !== ownersRows.length) {
        return jsonError('Si defines porcentaje, define para todos los responsables', 400)
      }
      const sum = ownersRows.reduce((s, o) => s + (o.sharePct || 0), 0)
      if (sum !== 100) return jsonError('Los porcentajes deben sumar 100', 400)
    }

    if (entityKindRequiresOwner(kind, subtype) && ownersRows.length === 0) {
      return jsonError(
        'Un activo que requiere responsable o una mascota debe tener al menos un dueño (integrante de la familia).',
        400
      )
    }

    if (ownersRows.length) {
      const members = await prisma.familyMember.findMany({
        where: { familyId, userId: { in: ownersRows.map((o) => o.userId) } },
        select: { userId: true },
      })
      const ok = new Set(members.map((m) => String(m.userId)))
      const bad = ownersRows.map((o) => o.userId).filter((uid) => !ok.has(uid))
      if (bad.length) return jsonError('Uno o más responsables no pertenecen a la familia', 400)
    }

    const created = await prisma.$transaction(async (tx) => {
      await ensureFamilyRootEntity(tx, familyId)
      const ent = await tx.entity.create({
        data: {
          familyId,
          type: kind,
          subtype,
          parentId: parentId || undefined,
          ownerEntityId: ownerEntityId || undefined,
          customTypeId: customTypeId || undefined,
          name,
          isActive: body.isActive !== false,
          participatesInBudget,
          participatesInReports,
        },
        select: {
          id: true,
          type: true,
          subtype: true,
          parentId: true,
          ownerEntityId: true,
          customTypeId: true,
          customType: { select: { id: true, name: true } },
          name: true,
          imageUrl: true,
          isActive: true,
          participatesInBudget: true,
          participatesInReports: true,
        },
      })
      if (ownersRows.length) {
        await tx.entityOwner.createMany({
          data: ownersRows.map((o) => ({
            familyId,
            entityId: ent.id,
            userId: o.userId,
            sharePct: o.sharePct,
          })),
        })
      }
      return tx.entity.findUniqueOrThrow({
        where: { id: ent.id },
        select: {
          id: true,
          type: true,
          subtype: true,
          parentId: true,
          ownerEntityId: true,
          customTypeId: true,
          customType: { select: { id: true, name: true } },
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

    const signed = {
      ...created,
      imageSignedUrl: await signIfSpaces((created as { imageUrl?: string | null })?.imageUrl),
    }
    return NextResponse.json({ ok: true, entity: signed }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo crear la entidad'
    return jsonError(msg, 500)
  }
}
