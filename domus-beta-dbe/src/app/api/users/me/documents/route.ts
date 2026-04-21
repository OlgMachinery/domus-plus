import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { uploadToSpaces, getSignedDownloadUrl, extractKeyFromSpacesUrl } from '@/lib/storage/spaces'
import { generateThumbnailBuffer } from '@/lib/documents/thumbnail'
import { getPdfPageCount, extractOfficialDocumentData } from '@/lib/documents/extract-official'
import { randomBytes } from 'node:crypto'

export const dynamic = 'force-dynamic'

const DEFAULT_CATEGORIES = ['IDENTIFICACIONES', 'ACTAS', 'VEHICULOS', 'RECETAS', 'PRESCRIPCIONES'] as const
const OFFICIAL_DOCUMENT_CATEGORIES = ['IDENTIFICACIONES', 'ACTAS'] as const
const OFFICIAL_MAX_PAGES = 2
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const CATEGORY_MAX_LEN = 80
// Cualquier archivo: imágenes, PDF, Office, texto, vídeo y genérico (evitar solo ejecutables)
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'text/',
  'application/pdf',
  'application/json',
  'application/vnd.',
  'application/msword',
  'application/octet-stream',
]

function safeCategory(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s_-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, CATEGORY_MAX_LEN) || 'Otro'
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document'
}

function getExt(mime: string, fileName: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime?.startsWith('image/')) {
    const map: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic' }
    return map[mime] || fileName.split('.').pop()?.toLowerCase() || 'jpg'
  }
  return fileName.split('.').pop()?.toLowerCase() || 'bin'
}

function isAllowedMime(mime: string): boolean {
  if (!mime) return false
  const lower = mime.toLowerCase()
  return ALLOWED_MIME_PREFIXES.some((p) => lower === p || lower.startsWith(p))
}

/** GET: listar documentos del usuario. ?category= para filtrar (cualquier categoría). */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const category = req.nextUrl.searchParams.get('category')
    const where: { userId: string; category?: string } = { userId }
    if (category != null && category !== '') where.category = category

    const docs = await prisma.userDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        category: true,
        name: true,
        fileName: true,
        contentType: true,
        createdAt: true,
        fileUrl: true,
        thumbnailUrl: true,
        extractedData: true,
        expiresAt: true,
      },
    })
    const withThumbUrls = await Promise.all(
      docs.map(async (d) => {
        let thumbnailSignedUrl: string | null = null
        if (d.thumbnailUrl) {
          const key = extractKeyFromSpacesUrl(d.thumbnailUrl)
          if (key) thumbnailSignedUrl = await getSignedDownloadUrl({ key, expiresInSeconds: 3600 })
        }
        return { ...d, thumbnailSignedUrl }
      })
    )
    return NextResponse.json({ ok: true, documents: withThumbUrls })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** POST: subir un documento. FormData: file (requerido), category (requerido), name (opcional). Categoría puede ser custom (ej. Motocicletas). */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    const form = await req.formData()
    const file = form.get('file')
    const categoryRaw = (form.get('category') as string)?.trim()
    const name = (form.get('name') as string)?.trim() || null

    if (!(file instanceof File)) return jsonError('Falta el archivo (file)', 400)
    const category = categoryRaw
      ? (DEFAULT_CATEGORIES.includes(categoryRaw as any) ? categoryRaw : safeCategory(categoryRaw))
      : ''
    if (!category) return jsonError('Indica la categoría (ej. Identificaciones, Actas, Motocicletas)', 400)

    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length < 1) return jsonError('El archivo está vacío', 400)
    if (bytes.length > MAX_BYTES) return jsonError('Archivo muy grande (máx 15 MB)', 400)

    const mime = (file.type || '').toLowerCase() || 'application/octet-stream'
    if (!isAllowedMime(mime)) return jsonError('Tipo de archivo no permitido. Usa imágenes, PDF o documentos de texto.', 400)

    const isOfficialCategory = OFFICIAL_DOCUMENT_CATEGORIES.includes(category as any)
    if (isOfficialCategory) {
      if (mime !== 'application/pdf' && !mime.startsWith('image/')) {
        return jsonError('En Identificaciones y Actas solo se permiten imágenes o PDF (documentos oficiales).', 400)
      }
      if (mime === 'application/pdf') {
        const pageCount = await getPdfPageCount(bytes)
        if (pageCount > OFFICIAL_MAX_PAGES) {
          return jsonError('Solo se permiten documentos oficiales de máximo 2 páginas.', 400)
        }
      }
    }

    const ext = getExt(mime, file.name)
    const baseName = safeFileName(file.name.replace(/\.[^.]+$/, '') || 'doc')
    const id = randomBytes(6).toString('hex')
    const key = `users/${userId}/documents/${category}/${id}-${baseName}.${ext}`
    const contentType = mime

    const fileUrl = await uploadToSpaces({ key, body: bytes, contentType })

    let thumbnailUrl: string | null = null
    try {
      const thumbBuf = await generateThumbnailBuffer(bytes, mime, file.name)
      if (thumbBuf && thumbBuf.length > 0) {
        const thumbKey = `users/${userId}/documents/thumbnails/${id}.jpg`
        thumbnailUrl = await uploadToSpaces({
          key: thumbKey,
          body: thumbBuf,
          contentType: 'image/jpeg',
        })
      }
    } catch {
      // Miniatura opcional; seguir sin ella
    }

    let doc = await prisma.userDocument.create({
      data: {
        userId,
        category,
        name: name || undefined,
        fileUrl,
        fileName: file.name || `${baseName}.${ext}`,
        contentType: mime || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
      },
      select: {
        id: true,
        category: true,
        name: true,
        fileName: true,
        contentType: true,
        createdAt: true,
        thumbnailUrl: true,
        extractedData: true,
        expiresAt: true,
      },
    })

    if (isOfficialCategory && (mime === 'application/pdf' || mime.startsWith('image/'))) {
      try {
        const { result } = await extractOfficialDocumentData(bytes, mime, category as 'IDENTIFICACIONES' | 'ACTAS')
        if (result?.extractedData && Object.keys(result.extractedData).length > 0) {
          doc = await prisma.userDocument.update({
            where: { id: doc.id },
            data: {
              extractedData: result.extractedData,
              expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
            },
            select: {
              id: true,
              category: true,
              name: true,
              fileName: true,
              contentType: true,
              createdAt: true,
              thumbnailUrl: true,
              extractedData: true,
              expiresAt: true,
            },
          })
        }
      } catch {
        // Procedimiento silencioso: no informar si falla la extracción
      }
    }

    return NextResponse.json({ ok: true, document: doc }, { status: 201 })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    if (e?.message?.includes('DO_SPACES')) return jsonError('No está configurado el almacenamiento de archivos', 503)
    return jsonError(e?.message || 'No se pudo subir el documento', 500)
  }
}
