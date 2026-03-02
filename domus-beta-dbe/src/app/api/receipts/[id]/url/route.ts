import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl } from '@/lib/storage/spaces'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: { id: true, familyId: true, fileUrl: true },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)

    const key = extractKeyFromSpacesUrl(receipt.fileUrl)
    if (!key) return jsonError('No se pudo generar el link del recibo', 500)

    const url = await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 10 })
    return NextResponse.json({ ok: true, url }, { status: 200 })
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo generar el link'
    return jsonError(msg, msg.includes('Falta') ? 400 : 500)
  }
}

