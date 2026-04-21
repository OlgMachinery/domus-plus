/**
 * SendGrid Inbound Parse webhook.
 * POST multipart/form-data: from, to, subject, text, html, attachments, attachment1, attachment2, ...
 * Fase 1: identificar usuario por "from" y responder 200. Fase 2+: procesar adjuntos e instrucciones.
 * Ver docs/DISENO_EMAIL_SENDGRID_ESCUELAS_Y_REGISTRO_PAGOS.md
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

function extractEmailFromFromField(from: string | null): string | null {
  if (!from || typeof from !== 'string') return null
  const trimmed = from.trim()
  const match = trimmed.match(/<([^>]+)>/)
  if (match) return match[1]!.trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+$/.test(trimmed)) return trimmed.toLowerCase()
  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fromRaw = formData.get('from')?.toString() || ''
    const to = formData.get('to')?.toString() || ''
    const subject = formData.get('subject')?.toString() || ''
    const text = formData.get('text')?.toString() || ''
    const html = formData.get('html')?.toString()
    const attachmentsCount = parseInt(String(formData.get('attachments') || '0'), 10) || 0

    const senderEmail = extractEmailFromFromField(fromRaw)
    if (!senderEmail) {
      console.warn('[sendgrid-inbound] No se pudo extraer email del remitente:', fromRaw?.slice(0, 80))
      return new NextResponse(null, { status: 200 })
    }

    const user = await prisma.user.findFirst({
      where: { email: senderEmail },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      console.log('[sendgrid-inbound] Remitente no registrado:', senderEmail, 'asunto:', subject?.slice(0, 60))
      // Opcional: enviar correo "Regístrate en Domus y añade este correo". Fase posterior.
      return new NextResponse(null, { status: 200 })
    }

    const membership = await prisma.familyMember.findFirst({
      where: { userId: user.id },
      select: { familyId: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!membership) {
      console.log('[sendgrid-inbound] Usuario sin familia:', user.email)
      return new NextResponse(null, { status: 200 })
    }

    // Fase 1: solo identificar. Fase 2: aquí procesar adjuntos (attachment1, attachment2, ...) y cuerpo (text/html).
    console.log('[sendgrid-inbound] OK usuario', user.email, 'familia', membership.familyId, 'adjuntos', attachmentsCount, 'asunto', subject?.slice(0, 50))
    return new NextResponse(null, { status: 200 })
  } catch (e) {
    console.error('[sendgrid-inbound] Error:', e)
    return new NextResponse(null, { status: 200 })
  }
}
