import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { uploadToSpaces } from '@/lib/storage/spaces'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic', // fotos desde Mac/iPhone
]
const IMAGE_MIME_PREFIX = 'image/'

function inferMimeAndExt(fileName: string, mime: string): { mime: string; ext: string } {
  const lower = (fileName || '').toLowerCase()
  if (mime && ALLOWED_MIME.includes(mime)) {
    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/heic' ? 'heic' : 'webp'
    return { mime, ext }
  }
  if (mime?.startsWith(IMAGE_MIME_PREFIX)) {
    const ext = lower.endsWith('.heic') ? 'heic' : lower.endsWith('.png') ? 'png' : lower.endsWith('.webp') ? 'webp' : 'jpg'
    return { mime: mime || 'image/jpeg', ext }
  }
  if (!mime || mime === 'application/octet-stream') {
    if (lower.endsWith('.heic')) return { mime: 'image/heic', ext: 'heic' }
    if (lower.endsWith('.png')) return { mime: 'image/png', ext: 'png' }
    if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' }
    if (lower.endsWith('.pdf')) return { mime: 'application/pdf', ext: 'pdf' }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { mime: 'image/jpeg', ext: 'jpg' }
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  return { mime: 'application/octet-stream', ext: 'bin' }
}

/** POST: subir factura para esta cosa. FormData: file */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    const thing = await prisma.userThing.findFirst({ where: { id, userId } })
    if (!thing) return jsonError('No encontrado', 404)

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return jsonError('Falta el archivo (file)', 400)
    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length < 1) return jsonError('El archivo está vacío', 400)
    if (bytes.length > MAX_BYTES) return jsonError('Máx 10 MB', 400)
    const rawMime = (file.type || '').toLowerCase()
    const { mime, ext } = inferMimeAndExt(file.name || '', rawMime)
    const allowed =
      ALLOWED_MIME.includes(mime) ||
      mime.startsWith(IMAGE_MIME_PREFIX) ||
      (rawMime !== mime && (rawMime === '' || rawMime === 'application/octet-stream') && mime.startsWith(IMAGE_MIME_PREFIX))
    if (!allowed && mime === 'application/octet-stream') {
      return jsonError('Formato no reconocido. Usa PDF o imagen (JPEG, PNG, WebP, HEIC).', 400)
    }
    if (mime !== 'application/pdf' && !mime.startsWith(IMAGE_MIME_PREFIX)) {
      return jsonError('Solo PDF o imagen (JPEG, PNG, WebP, HEIC).', 400)
    }
    const key = `users/${userId}/things/${id}/invoice-${randomBytes(4).toString('hex')}.${ext}`
    const fileUrl = await uploadToSpaces({ key, body: bytes, contentType: mime })

    await prisma.userThing.update({
      where: { id },
      data: { invoiceUrl: fileUrl },
    })
    return NextResponse.json({ ok: true, invoiceUrl: fileUrl })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    if (e?.message?.includes('DO_SPACES')) return jsonError('Almacenamiento no configurado', 503)
    return jsonError(e?.message || 'Error', 500)
  }
}
