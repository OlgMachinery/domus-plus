import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { extractKeyFromSpacesUrl, getSignedDownloadUrl } from '@/lib/storage/spaces'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        fileUrl: true,
        images: { select: { id: true, sortOrder: true, fileUrl: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)

    const imgs =
      Array.isArray(receipt.images) && receipt.images.length
        ? receipt.images
        : [{ id: receipt.id, sortOrder: 1, fileUrl: receipt.fileUrl }]

    const signed = await Promise.all(
      imgs.map(async (img) => {
        const key = extractKeyFromSpacesUrl(img.fileUrl)
        const url = key ? await getSignedDownloadUrl({ key, expiresInSeconds: 60 * 10 }) : img.fileUrl
        return { id: img.id, sortOrder: img.sortOrder, url }
      })
    )

    return NextResponse.json({ ok: true, receiptId: receipt.id, images: signed }, { status: 200 })
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo obtener las imágenes del recibo'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { familyId } = await requireMembership(req)
    const { id } = await params

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        images: { select: { id: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!receipt) return jsonError('Recibo no encontrado', 404)
    if (receipt.familyId !== familyId) return jsonError('No tienes acceso a este recibo', 403)
    if (!Array.isArray(receipt.images) || receipt.images.length < 2) {
      return jsonError('Este recibo no tiene partes para reordenar.', 409)
    }

    const body = (await req.json().catch(() => ({}))) as any
    const orderRaw = body?.order
    const order = Array.isArray(orderRaw) ? orderRaw.map((x: any) => String(x || '')).filter(Boolean) : null
    if (!order || !order.length) return jsonError('Debes enviar `order: string[]`', 400)

    const currentIds = receipt.images.map((img) => String(img.id))
    if (order.length !== currentIds.length) {
      return jsonError('El orden no coincide con el número de partes del recibo.', 400)
    }
    const set = new Set(order)
    if (set.size !== order.length) return jsonError('El orden contiene IDs duplicados.', 400)
    for (const imgId of currentIds) {
      if (!set.has(imgId)) return jsonError('El orden no coincide con las partes actuales del recibo.', 400)
    }

    await prisma.$transaction(async (tx) => {
      // Paso 1: mover a un rango temporal para evitar colisión del @@unique([receiptId, sortOrder]).
      for (const img of receipt.images) {
        await tx.receiptImage.update({
          where: { id: img.id },
          data: { sortOrder: 1000 + Number(img.sortOrder || 0) },
        })
      }
      // Paso 2: aplicar el nuevo orden 1..N
      for (let i = 0; i < order.length; i += 1) {
        const imgId = order[i]!
        await tx.receiptImage.update({ where: { id: imgId }, data: { sortOrder: i + 1 } })
      }
    })

    const images = await prisma.receiptImage.findMany({
      where: { receiptId: receipt.id },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ ok: true, receiptId: receipt.id, images }, { status: 200 })
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'No se pudo reordenar las imágenes del recibo'
    const status =
      msg === 'No autenticado' ? 401 : msg === 'No hay familia activa' ? 400 : msg === 'No tienes acceso a esta familia' ? 403 : 500
    return jsonError(msg, status)
  }
}

