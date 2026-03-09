import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl, uploadToSpaces } from '@/lib/storage/spaces'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)

    const { id } = await params
    const entity = await prisma.budgetEntity.findUnique({
      where: { id },
      select: { id: true, familyId: true },
    })
    if (!entity) return jsonError('Entidad no encontrada', 404)
    if (entity.familyId !== familyId) return jsonError('No tienes acceso a esta entidad', 403)

    const isOwner = await prisma.budgetEntityOwner.findUnique({
      where: { entityId_userId: { entityId: id, userId } },
      select: { userId: true },
    })
    if (!isFamilyAdmin && !isOwner) return jsonError('Solo el administrador o el responsable de la partida pueden subir su foto', 403)

    const form = await req.formData()
    const f = form.get('file')
    if (!(f instanceof File)) return jsonError('Debes adjuntar 1 imagen (file)', 400)
    if (f.size < 1) return jsonError('El archivo está vacío', 400)
    if (f.size > 8 * 1024 * 1024) return jsonError('La imagen es muy grande (máx 8MB)', 400)

    const ab = await f.arrayBuffer()
    const bytes = Buffer.from(ab)

    let out: Buffer
    try {
      out = await sharp(bytes, { failOnError: false })
        .rotate()
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 82 })
        .toBuffer()
    } catch {
      return jsonError('No se pudo procesar la imagen', 400)
    }

    const ext = 'webp'
    const rand = randomBytes(4).toString('hex')
    const key = `families/${familyId}/entities/${id}/avatar-${Date.now()}-${rand}-${safeName(f.name)}.${ext}`
    const fileUrl = await uploadToSpaces({ key, body: out, contentType: 'image/webp' })

    const updated = await prisma.budgetEntity.update({
      where: { id },
      data: { imageUrl: fileUrl },
      select: { id: true, imageUrl: true },
    })

    return NextResponse.json(
      { ok: true, entity: { ...updated, imageSignedUrl: await signIfSpaces(updated.imageUrl) } },
      { status: 201 }
    )
  } catch (e: any) {
    const raw = typeof e?.message === 'string' ? e.message : 'No se pudo subir la imagen'
    const lower = raw.toLowerCase()
    if (
      lower.includes('faltan variables do_spaces_') ||
      lower.includes('falta do_spaces_bucket') ||
      lower.includes('falta configuración de spaces') ||
      raw.includes('Falta') ||
      raw.includes('Faltan variables DO_SPACES_') ||
      raw.includes('Falta configuración de Spaces')
    ) {
      return jsonError('Falta configurar DigitalOcean Spaces (DO_SPACES_*).', 400)
    }
    return jsonError(raw, 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId, isFamilyAdmin } = await requireMembership(req)

    const { id } = await params
    const entity = await prisma.budgetEntity.findUnique({
      where: { id },
      select: { id: true, familyId: true },
    })
    if (!entity) return jsonError('Entidad no encontrada', 404)
    if (entity.familyId !== familyId) return jsonError('No tienes acceso a esta entidad', 403)

    const isOwner = await prisma.budgetEntityOwner.findUnique({
      where: { entityId_userId: { entityId: id, userId } },
      select: { userId: true },
    })
    if (!isFamilyAdmin && !isOwner) return jsonError('Solo el administrador o el responsable de la partida pueden quitar la foto', 403)

    await prisma.budgetEntity.update({ where: { id }, data: { imageUrl: null }, select: { id: true } })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return jsonError(e?.message || 'No se pudo eliminar la imagen', 500)
  }
}

