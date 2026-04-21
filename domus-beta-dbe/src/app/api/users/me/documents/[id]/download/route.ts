import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { getSignedDownloadUrl, extractKeyFromSpacesUrl } from '@/lib/storage/spaces'

export const dynamic = 'force-dynamic'

/** GET: devolver URL firmada para ver/descargar el documento (solo el dueño). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params

    const doc = await prisma.userDocument.findFirst({
      where: { id, userId },
      select: { fileUrl: true },
    })
    if (!doc) return jsonError('Documento no encontrado', 404)

    const key = extractKeyFromSpacesUrl(doc.fileUrl)
    const url = key
      ? await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 10 })
      : doc.fileUrl
    return NextResponse.json({ ok: true, url })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
