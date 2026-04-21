import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireAuth } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { extractKeyFromSpacesUrl, getObjectAsBuffer } from '@/lib/storage/spaces'
import { extractOfficialDocumentData } from '@/lib/documents/extract-official'

export const dynamic = 'force-dynamic'

const OFFICIAL_CATEGORIES = ['IDENTIFICACIONES', 'ACTAS'] as const

/** POST: volver a ejecutar extracción de datos (solo doc oficial, imagen o PDF). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({
        ok: false,
        message: 'OPENAI_API_KEY no está configurada en el servidor. En producción (VPS) añádela al archivo .env del servidor (ej. /srv/domus/app/.env) con la variable OPENAI_API_KEY=sk-... y reinicia el servicio.',
      }, { status: 503 })
    }

    const { userId } = await requireAuth(req)
    const { id } = await params

    const doc = await prisma.userDocument.findFirst({
      where: { id, userId },
      select: { id: true, fileUrl: true, contentType: true, category: true },
    })
    if (!doc) return jsonError('Documento no encontrado', 404)
    if (!OFFICIAL_CATEGORIES.includes(doc.category as any)) {
      return jsonError('La extracción automática solo aplica a Identificaciones o Actas.', 400)
    }
    const mime = (doc.contentType || '').toLowerCase()
    if (mime !== 'application/pdf' && !mime.startsWith('image/')) {
      return jsonError('Solo se puede extraer de PDF o imagen.', 400)
    }

    const key = extractKeyFromSpacesUrl(doc.fileUrl)
    if (!key) return jsonError('No se pudo acceder al archivo.', 400)

    const bytes = await getObjectAsBuffer(key)
    const { result, reason } = await extractOfficialDocumentData(
      bytes,
      mime,
      doc.category as 'IDENTIFICACIONES' | 'ACTAS'
    )

    if (!result?.extractedData || Object.keys(result.extractedData).length === 0) {
      const messages: Record<string, string> = {
        pdf_no_pages: 'No se pudo convertir el PDF a imagen. Prueba subiendo una foto clara del documento (JPG o PNG) en lugar del PDF escaneado.',
        openai_error: 'Error al conectar con el servicio de extracción. Vuelve a intentarlo en unos minutos.',
        openai_empty_response: 'La imagen no devolvió datos legibles. Asegúrate de que el documento esté bien iluminado, sin recortes y que se vea el texto.',
        openai_invalid_json: 'El servicio devolvió una respuesta inesperada. Prueba con otra foto más clara del documento.',
      }
      const message = messages[reason ?? ''] ?? 'La extracción no devolvió datos. Comprueba que el PDF o imagen sea legible (buena luz, sin cortes). Si es un PDF escaneado, prueba con una foto clara del documento.'
      return NextResponse.json({ ok: false, message }, { status: 422 })
    }

    const updated = await prisma.userDocument.update({
      where: { id },
      data: {
        extractedData: result.extractedData,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
      },
      select: { id: true, extractedData: true, expiresAt: true },
    })
    return NextResponse.json({ ok: true, document: updated })
  } catch (e: any) {
    if (e?.message === 'No autenticado') return jsonError(e.message, 401)
    console.warn('[documents/extract]', e?.message || e)
    return jsonError(e?.message || 'Error al extraer datos', 500)
  }
}
