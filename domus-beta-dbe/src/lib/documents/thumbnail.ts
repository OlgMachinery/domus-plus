/**
 * Genera miniatura ~1×1 pulgada (96×96 px) para listados de documentos.
 * Imágenes: resize con sharp. PDF: primera página con pdf-to-img y sharp.
 */
import sharp from 'sharp'

const THUMB_SIZE = 96 // 96 px ≈ 1 inch @ 96 DPI

export async function generateThumbnailBuffer(
  fileBuffer: Buffer,
  mime: string,
  fileName: string
): Promise<Buffer | null> {
  const mimeLower = (mime || '').toLowerCase()
  try {
    if (mimeLower.startsWith('image/')) {
      return await sharp(fileBuffer)
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toBuffer()
    }
    if (mimeLower === 'application/pdf') {
      const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer)
      for (const scale of [0.5, 1]) {
        try {
          const { pdf } = await import('pdf-to-img')
          const doc = await pdf(buf, { scale })
          let first: Buffer | null = null
          for await (const page of doc) {
            first = Buffer.isBuffer(page) ? page : Buffer.from(page)
            break
          }
          if (!first) continue
          return await sharp(first)
            .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toBuffer()
        } catch (e) {
          if (scale === 1) console.warn('[thumbnail] PDF first page failed:', (e as Error)?.message || e)
        }
      }
      return null
    }
  } catch (e) {
    console.warn('[thumbnail] generateThumbnailBuffer error:', (e as Error)?.message || e)
  }
  return null
}
