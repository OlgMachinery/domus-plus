import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { uploadToSpaces } from '@/lib/storage/spaces'

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'file'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const { id: transactionId } = await params

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, familyId: true },
    })
    if (!tx) return jsonError('Gasto no encontrado', 404)
    if (tx.familyId !== familyId) return jsonError('No tienes acceso a este gasto', 403)

    const form = await req.formData()
    const rawFiles = form.getAll('file')
    const files = rawFiles.filter((f) => f instanceof File) as File[]
    if (!files.length) return jsonError('Debes adjuntar al menos 1 archivo (file)', 400)
    if (files.length > 8) return jsonError('Demasiadas fotos. Sube máximo 8.', 400)

    const uploaded = await Promise.all(
      files.map(async (file, idx) => {
        const arrayBuffer = await file.arrayBuffer()
        const bytes = Buffer.from(arrayBuffer)
        if (bytes.length < 1) throw new Error('El archivo está vacío')
        const key = `families/${familyId}/transactions/${transactionId}/${Date.now()}-${idx + 1}-${safeName(file.name)}`
        const fileUrl = await uploadToSpaces({
          key,
          body: bytes,
          contentType: file.type || 'application/octet-stream',
        })
        return { fileUrl, sortOrder: idx + 1 }
      })
    )

    const coverUrl = uploaded[uploaded.length - 1]?.fileUrl || uploaded[0]!.fileUrl

    const receipt = await prisma.receipt.create({
      data: {
        transactionId,
        userId,
        familyId,
        fileUrl: coverUrl,
        images: {
          create: uploaded.map((u) => ({
            fileUrl: u.fileUrl,
            sortOrder: u.sortOrder,
          })),
        },
      },
      select: { id: true, fileUrl: true, createdAt: true, images: { select: { id: true, sortOrder: true } } },
    })

    return NextResponse.json({ ok: true, receipt }, { status: 201 })
  } catch (e: any) {
    const raw = typeof e?.message === 'string' ? e.message : 'No se pudo subir el recibo'
    const code =
      (typeof e?.Code === 'string' && e.Code) ||
      (typeof e?.code === 'string' && e.code) ||
      (typeof e?.name === 'string' && e.name) ||
      ''
    const httpStatus = typeof e?.$metadata?.httpStatusCode === 'number' ? e.$metadata.httpStatusCode : null
    const lower = `${raw} ${code}`.toLowerCase()

    if (
      lower.includes('faltan variables do_spaces_') ||
      lower.includes('falta do_spaces_bucket') ||
      lower.includes('falta configuración de spaces') ||
      raw.includes('Falta') ||
      raw.includes('Faltan variables DO_SPACES_') ||
      raw.includes('Falta configuración de Spaces')
    ) {
      return jsonError('Falta configurar DigitalOcean Spaces (DO_SPACES_*).', 400)
    }
    if (lower.includes('archivo está vacío') || lower.includes('archivo esta vacio')) {
      return jsonError('El archivo está vacío', 400)
    }
    if (code === 'NoSuchBucket' || lower.includes('bucket does not exist') || lower.includes('nosuchbucket')) {
      return jsonError('El bucket de DigitalOcean Spaces no existe. Revisa DO_SPACES_BUCKET y la región (DO_SPACES_REGION).', 400)
    }
    if (code === 'InvalidAccessKeyId' || lower.includes('invalidaccesskeyid')) {
      return jsonError(
        'La llave de DigitalOcean Spaces (DO_SPACES_KEY) es inválida (InvalidAccessKeyId). Verifica que sea un “Spaces Access Key” y no un token, y que esté bien copiada.',
        400
      )
    }
    if (code === 'SignatureDoesNotMatch' || lower.includes('signaturedoesnotmatch')) {
      return jsonError(
        'La secret de DigitalOcean Spaces (DO_SPACES_SECRET) no coincide con la llave (SignatureDoesNotMatch). Verifica que copiaste la secret correcta.',
        400
      )
    }
    if (code === 'AccessDenied' || lower.includes('access denied') || lower.includes('accessdenied') || httpStatus === 403) {
      return jsonError(
        'Las llaves de DigitalOcean Spaces no tienen permiso para ese bucket (AccessDenied). Revisa permisos o genera una llave con acceso al Space/bucket.',
        400
      )
    }

    const safeDetail = code && raw !== code ? `${raw} (${code})` : raw
    return jsonError(safeDetail, 500)
  }
}

