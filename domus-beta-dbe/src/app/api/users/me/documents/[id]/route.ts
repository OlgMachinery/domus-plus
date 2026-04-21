import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

/** PATCH: actualizar datos extraídos y/o fecha de vencimiento (solo el dueño). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params

    const doc = await prisma.userDocument.findFirst({
      where: { id, userId },
    })
    if (!doc) return jsonError('Documento no encontrado', 404)

    const body = await req.json().catch(() => ({}))
    const extractedData = body.extractedData
    const expiresAt = body.expiresAt

    const data: { extractedData?: object; expiresAt?: Date | null } = {}
    if (extractedData !== undefined) {
      data.extractedData = typeof extractedData === 'object' && extractedData !== null ? extractedData : undefined
    }
    if (expiresAt !== undefined) {
      data.expiresAt = expiresAt == null || expiresAt === '' ? null : new Date(expiresAt)
    }

    const updated = await prisma.userDocument.update({
      where: { id },
      data,
      select: { id: true, extractedData: true, expiresAt: true },
    })
    return NextResponse.json({ ok: true, document: updated })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}

/** DELETE: eliminar un documento del usuario (solo el dueño). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params

    const doc = await prisma.userDocument.findFirst({
      where: { id, userId },
    })
    if (!doc) return jsonError('Documento no encontrado', 404)

    await prisma.userDocument.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error', 500)
  }
}
