import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { uploadToSpaces, getSignedDownloadUrl, extractKeyFromSpacesUrl } from '@/lib/storage/spaces'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    const form = await req.formData()
    const f = form.get('file')
    if (!(f instanceof File)) return jsonError('Adjunta una imagen (file)', 400)
    if (f.size < 1) return jsonError('El archivo está vacío', 400)
    if (f.size > 5 * 1024 * 1024) return jsonError('Imagen muy grande (máx 5MB)', 400)

    const ab = await f.arrayBuffer()
    const bytes = Buffer.from(ab)

    let out: Buffer
    try {
      out = await sharp(bytes, { failOnError: false })
        .rotate()
        .resize(192, 192, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer()
    } catch {
      return jsonError('No se pudo procesar la imagen', 400)
    }

    const rand = randomBytes(4).toString('hex')
    const key = `users/${userId}/avatar-${Date.now()}-${rand}.webp`
    const fileUrl = await uploadToSpaces({ key, body: out, contentType: 'image/webp' })

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: fileUrl },
    })

    return NextResponse.json({ ok: true, avatarUrl: fileUrl })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    if (e?.message?.includes('DO_SPACES')) return jsonError('No está configurado el almacenamiento de archivos', 503)
    return jsonError(e?.message || 'No se pudo subir la foto', 500)
  }
}

/** GET: devolver URL firmada del avatar del usuario actual (para mostrar en UI). */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    })
    if (!user?.avatarUrl) return jsonError('Sin avatar', 404)
    const key = extractKeyFromSpacesUrl(user.avatarUrl)
    if (!key) return NextResponse.json({ ok: true, avatarUrl: user.avatarUrl })
    const signed = await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 60 })
    return NextResponse.json({ ok: true, avatarUrl: signed })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
