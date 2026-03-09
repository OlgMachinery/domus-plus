import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { generateMoneyRequestRegistrationCode } from '@/lib/registration-code'
import { sendWhatsAppMessageAndGetSid } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

function toDecimal(value: unknown): { n: number; ok: boolean } {
  if (value == null) return { n: 0, ok: false }
  const n = Number(typeof value === 'string' ? value.replace(',', '.') : value)
  if (!Number.isFinite(n) || n < 0) return { n: 0, ok: false }
  return { n, ok: true }
}

export async function GET(req: NextRequest) {
  try {
    const { familyId } = await requireMembership(req)
    const statusParam = req.nextUrl.searchParams.get('status')
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')

    const where: { familyId: string; status?: string; date?: { gte?: Date; lte?: Date } } = { familyId }
    if (statusParam && ['PENDING', 'APPROVED', 'REJECTED', 'DELIVERED'].includes(statusParam)) {
      where.status = statusParam
    }
    if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      where.date = { ...where.date, gte: new Date(fromParam + 'T00:00:00.000Z') }
    }
    if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      where.date = { ...where.date, lte: new Date(toParam + 'T23:59:59.999Z') }
    }

    const list = await prisma.moneyRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        createdByUserId: true,
        requestedAt: true,
        forEntityId: true,
        forName: true,
        allocationId: true,
        date: true,
        reason: true,
        amount: true,
        currency: true,
        status: true,
        transactionId: true,
        registrationCode: true,
        approvedAt: true,
        approvedByUserId: true,
        rejectedAt: true,
        rejectedByUserId: true,
        deliveredAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        forEntity: { select: { id: true, name: true, type: true } },
        allocation: {
          select: {
            id: true,
            entity: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json({
      ok: true,
      moneyRequests: list.map((r) => ({
        id: r.id,
        familyId: r.familyId,
        createdByUserId: r.createdByUserId,
        requestedAt: r.requestedAt.toISOString(),
        forEntityId: r.forEntityId ?? null,
        forName: r.forName ?? null,
        allocationId: r.allocationId ?? null,
        date: r.date.toISOString(),
        reason: r.reason,
        amount: r.amount.toString(),
        currency: r.currency,
        status: r.status,
        transactionId: r.transactionId ?? null,
        registrationCode: r.registrationCode ?? null,
        approvedAt: r.approvedAt?.toISOString() ?? null,
        approvedByUserId: r.approvedByUserId ?? null,
        rejectedAt: r.rejectedAt?.toISOString() ?? null,
        rejectedByUserId: r.rejectedByUserId ?? null,
        deliveredAt: r.deliveredAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        createdBy: r.createdBy,
        forEntity: r.forEntity ?? null,
        allocation: r.allocation ?? null,
      })),
    })
  } catch (e: any) {
    if (e?.message === 'No autenticado' || e?.message === 'No hay familia activa' || e?.message?.includes('acceso')) {
      return jsonError(e.message, 401)
    }
    return jsonError(e?.message || 'Error al listar solicitudes', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const { n: amount, ok: amountOk } = toDecimal(body.amount)
    const forEntityId = typeof body.forEntityId === 'string' ? body.forEntityId.trim() || null : null
    const forName = typeof body.forName === 'string' ? body.forName.trim() || null : null
    const allocationId = typeof body.allocationId === 'string' ? body.allocationId.trim() || null : null
    let date: Date
    if (typeof body.date === 'string' && body.date) {
      const d = new Date(body.date)
      date = Number.isNaN(d.getTime()) ? new Date() : d
    } else {
      date = new Date()
    }
    const currency = typeof body.currency === 'string' ? body.currency.trim() || 'MXN' : 'MXN'

    if (!reason) return jsonError('Falta el motivo', 400)
    if (!amountOk || amount <= 0) return jsonError('Monto inválido', 400)

    if (forEntityId) {
      const entity = await prisma.budgetEntity.findUnique({
        where: { id: forEntityId },
        select: { familyId: true },
      })
      if (!entity || entity.familyId !== familyId) return jsonError('Partida no encontrada o sin acceso', 403)
    }
    if (allocationId) {
      const alloc = await prisma.entityBudgetAllocation.findUnique({
        where: { id: allocationId },
        select: { familyId: true },
      })
      if (!alloc || alloc.familyId !== familyId) return jsonError('Asignación no encontrada o sin acceso', 403)
    }

    const registrationCode = await generateMoneyRequestRegistrationCode(prisma, familyId)
    const created = await prisma.moneyRequest.create({
      data: {
        familyId,
        createdByUserId: userId,
        forEntityId,
        forName,
        allocationId,
        date,
        reason,
        amount,
        currency,
        status: 'PENDING',
        registrationCode,
      },
      select: {
        id: true,
        registrationCode: true,
        requestedAt: true,
        amount: true,
        reason: true,
        status: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
    })

    // Notificar al admin por WhatsApp y guardar SID para vincular reply (comprobante)
    const adminMember = await prisma.familyMember.findFirst({
      where: { familyId, isFamilyAdmin: true },
      select: { user: { select: { phone: true } } },
    })
    const adminPhone = adminMember?.user?.phone
    if (adminPhone) {
      const creatorName = created.createdBy?.name || created.createdBy?.email || 'Alguien'
      const amountStr = Number(created.amount).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      const body = `Nueva solicitud de efectivo: *${created.registrationCode ?? '—'}*\nMotivo: ${created.reason}\nMonto: $${amountStr} ${currency}\nSolicitante: ${creatorName}\n\n_Responde a ESTE mensaje con la foto del comprobante para registrar la entrega._`
      const sent = await sendWhatsAppMessageAndGetSid(adminPhone, body)
      if (sent.ok && sent.sid) {
        await prisma.moneyRequest.update({
          where: { id: created.id },
          data: { outboundMessageSid: sent.sid },
        })
      }
    }

    return NextResponse.json(
      {
        ok: true,
        moneyRequest: {
          id: created.id,
          registrationCode: created.registrationCode,
          requestedAt: created.requestedAt.toISOString(),
          amount: created.amount.toString(),
          reason: created.reason,
          status: created.status,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (e: any) {
    if (e?.message === 'No autenticado' || e?.message === 'No hay familia activa') return jsonError(e.message, 401)
    return jsonError(e?.message || 'Error al crear solicitud', 500)
  }
}
