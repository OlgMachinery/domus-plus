import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { EntityType } from '@/generated/prisma/client'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl } from '@/lib/storage/spaces'

function asEntityType(value: unknown): EntityType | null {
  if (typeof value !== 'string') return null
  const allowed = Object.values(EntityType) as string[]
  if (allowed.includes(value)) return value as EntityType
  return null
}

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
    const { familyId } = await requireMembership(req)
    const entities = await prisma.budgetEntity.findMany({
      where: { familyId },
      select: {
        id: true,
        type: true,
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
        imageSignedUrl: await signIfSpaces((e as any)?.imageUrl),
      }))
    )
    return NextResponse.json({ ok: true, entities: withSigned }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No autenticado', 401)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede crear entidades', 403)

    const body = await req.json().catch(() => ({}))
    const type = asEntityType(body.type)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const participatesInBudget = body.participatesInBudget !== false
    const participatesInReports = body.participatesInReports !== false
    if (!type) return jsonError('Tipo inválido', 400)
    if (!name) return jsonError('Nombre requerido', 400)

    const created = await prisma.budgetEntity.create({
      data: {
        familyId,
        type,
        name,
        isActive: body.isActive !== false,
        participatesInBudget,
        participatesInReports,
      },
      select: { id: true, type: true, name: true, imageUrl: true, isActive: true, participatesInBudget: true, participatesInReports: true },
    })
    return NextResponse.json({ ok: true, entity: created }, { status: 201 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo crear la entidad', 500)
  }
}

