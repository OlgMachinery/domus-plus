/**
 * Eventos de calendario no financieros (familia).
 * POST: crear evento. Body: { title, eventDate (YYYY-MM-DD), type?, description? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['birthday', 'appointment', 'reminder', 'vacation', 'custom']

export async function POST(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const body = await req.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return jsonError('Falta el título del evento', 400)

    let eventDate: Date
    if (typeof body.eventDate === 'string') {
      const d = new Date(body.eventDate)
      if (Number.isNaN(d.getTime())) return jsonError('Fecha inválida', 400)
      eventDate = d
    } else {
      return jsonError('Falta eventDate (YYYY-MM-DD)', 400)
    }

    const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'custom'
    const description = typeof body.description === 'string' ? body.description.trim() || null : null

    const event = await prisma.familyCalendarEvent.create({
      data: {
        familyId,
        title,
        eventDate,
        type,
        description,
      },
    })

    return NextResponse.json({
      ok: true,
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate.toISOString().slice(0, 10),
        type: event.type,
        description: event.description,
      },
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al crear evento', 500)
  }
}
