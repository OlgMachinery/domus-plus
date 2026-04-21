/**
 * GET /api/setup/asset-media/signed?url=...
 * Redirige a una URL firmada de Spaces para ver la foto/video del activo.
 * Usar como src de img o video cuando el bucket es privado (evita 403).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireMembership } from '@/lib/auth/session'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl } from '@/lib/storage/spaces'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireMembership(req)

    const url = req.nextUrl.searchParams.get('url')
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Falta query url' }, { status: 400 })
    }

    const key = extractKeyFromSpacesUrl(url.trim())
    if (!key) {
      return NextResponse.json({ error: 'URL no es de Spaces' }, { status: 400 })
    }

    const signedUrl = await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 10 })
    return NextResponse.redirect(signedUrl, 302)
  } catch {
    return NextResponse.json({ error: 'No autorizado o error al firmar' }, { status: 403 })
  }
}
