/**
 * POST /api/setup/upload-asset-media
 * Sube una foto o video para un activo (onboarding o edición). Devuelve la URL en storage.
 * Límites: fotos 3-10 por ítem, videos 2 por ítem (validados en cliente y al guardar activo).
 */

import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { uploadToSpaces } from '@/lib/storage/spaces'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

const MAX_PHOTO_BYTES = 12 * 1024 * 1024   // 12 MB
const MAX_VIDEO_BYTES = 80 * 1024 * 1024  // 80 MB
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
}

function getExt(mime: string, filename: string): string {
  if (mime === 'image/jpeg' || filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'video/mp4') return 'mp4'
  if (mime === 'video/webm') return 'webm'
  if (mime === 'video/quicktime') return 'mov'
  return 'bin'
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, isFamilyAdmin } = await requireMembership(req)
    if (!isFamilyAdmin) return jsonError('Solo el administrador puede subir archivos de activos', 403)

    const form = await req.formData()
    const file = form.get('file')
    const kind = (form.get('kind') as string)?.toUpperCase()

    if (!(file instanceof File)) return jsonError('Falta el archivo (file)', 400)
    if (kind !== 'PHOTO' && kind !== 'VIDEO') return jsonError('kind debe ser PHOTO o VIDEO', 400)

    const mime = file.type?.toLowerCase() || ''
    const isPhoto = PHOTO_TYPES.includes(mime)
    const isVideo = VIDEO_TYPES.includes(mime)

    if (kind === 'PHOTO' && !isPhoto) return jsonError('Formato de imagen no válido (JPEG, PNG, WebP, GIF)', 400)
    if (kind === 'VIDEO' && !isVideo) return jsonError('Formato de video no válido (MP4, WebM, MOV)', 400)

    const bytes = Buffer.from(await file.arrayBuffer())
    if (kind === 'PHOTO' && bytes.length > MAX_PHOTO_BYTES) return jsonError('La imagen es muy grande (máx 12 MB)', 400)
    if (kind === 'VIDEO' && bytes.length > MAX_VIDEO_BYTES) return jsonError('El video es muy grande (máx 80 MB)', 400)

    const ext = getExt(mime, file.name)
    const rand = randomBytes(4).toString('hex')
    const key = `families/${familyId}/assets/uploads/${kind.toLowerCase()}-${Date.now()}-${rand}-${safeName(file.name)}.${ext}`

    const contentType = mime || (kind === 'PHOTO' ? 'image/jpeg' : 'video/mp4')
    const url = await uploadToSpaces({ key, body: bytes, contentType })

    return NextResponse.json({ ok: true, url, kind }, { status: 201 })
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : 'No se pudo subir el archivo'
    const lower = raw.toLowerCase()
    if (lower.includes('do_spaces') || lower.includes('spaces') || lower.includes('falta')) {
      return jsonError('Falta configurar almacenamiento (DO_SPACES_*).', 400)
    }
    return jsonError(raw, 500)
  }
}
