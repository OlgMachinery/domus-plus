import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { generateRegistrationCode, type PrismaLike } from '@/lib/registration-code'

export const dynamic = 'force-dynamic'

const DATA_URL_RECEIPT = 'data:text/plain;base64,' + Buffer.from('DOMUS+ — Recibo demo (consumo)').toString('base64')

const DEMO_CONSUMPTION_ITEMS = [
  { description: 'LECHE ENTERA 1L', quantity: 2, quantityUnit: 'L' },
  { description: 'PASTA SPAGHETTI 450G', quantity: 2, quantityUnit: 'g' },
  { description: 'MAYONESA 500G', quantity: 1, quantityUnit: 'g' },
  { description: 'AGUA MINERAL 6.1L', quantity: 1, quantityUnit: 'L' },
  { description: 'ACEITE 900ML', quantity: 1, quantityUnit: 'ml' },
  { description: 'ARROZ 1KG', quantity: 2, quantityUnit: 'kg' },
  { description: 'JABÓN DOVE 12/1L', quantity: 1, quantityUnit: 'L' },
  { description: 'AZÚCAR 2KG', quantity: 1, quantityUnit: 'kg' },
  { description: 'DETERGENTE 2L', quantity: 1, quantityUnit: 'L' },
]

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

/** Fecha dentro del mes actual (día 1 + offset días) para que el filtro "Mes" muestre los datos. */
function thisMonthDay(dayOffset: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  d.setDate(d.getDate() + dayOffset)
  return d
}

/** POST: crea transacciones + recibos + extracciones de consumo (super + luz + agua). No requiere recibos previos. */
export async function POST(req: NextRequest) {
  try {
    const { familyId, userId } = await requireMembership(req)

    const entities = await prisma.budgetEntity.findMany({ where: { familyId }, select: { id: true, name: true } })
    const casa = entities.find((e) => e.name?.trim().toLowerCase() === 'casa')
    const categories = await prisma.budgetCategory.findMany({ where: { familyId }, select: { id: true, name: true } })
    const catServicios = categories.find((c) => (c.name || '').toLowerCase().includes('servicios'))
    const catSuper = categories.find((c) => (c.name || '').trim().toLowerCase() === 'supermercado')

    if (!casa || !catServicios) {
      return jsonError(
        'Faltan partida "Casa" o categoría "Servicios". Ejecuta antes "Cargar datos ficticios" en Configuración.',
        400
      )
    }

    const allocationServicios = await prisma.entityBudgetAllocation.findFirst({
      where: { familyId, entityId: casa.id, categoryId: catServicios.id },
      select: { id: true },
    })
    if (!allocationServicios) {
      return jsonError(
        'Falta partida Casa + Servicios. Ejecuta antes "Cargar datos ficticios".',
        400
      )
    }

    const allocationSuper = catSuper
      ? await prisma.entityBudgetAllocation.findFirst({
          where: { familyId, entityId: casa.id, categoryId: catSuper.id },
          select: { id: true },
        })
      : null
    const allocationForSuper = allocationSuper?.id ?? allocationServicios.id

    const periodStart = daysAgo(35)
    const periodEnd = daysAgo(5)
    const receiptIds: string[] = []

    await prisma.$transaction(async (tx) => {
      const descriptions = ['Super Demo (consumo)', 'Recibo CFE (demo)', 'Recibo Agua (demo)'] as const
      const configs = [
        { allocationId: allocationForSuper, amount: '1350', date: thisMonthDay(2) },
        { allocationId: allocationServicios.id, amount: '450', date: thisMonthDay(4) },
        { allocationId: allocationServicios.id, amount: '120', date: thisMonthDay(6) },
      ]

      for (let i = 0; i < 3; i++) {
        const desc = descriptions[i]
        const cfg = configs[i]
        let txId: string | null = await tx.transaction
          .findFirst({
            where: { familyId, allocationId: cfg.allocationId, description: desc },
            select: { id: true },
          })
          .then((r) => r?.id ?? null)

        if (!txId) {
          const registrationCode = await generateRegistrationCode(tx as PrismaLike, familyId, 'E')
          const created = await tx.transaction.create({
            data: {
              familyId,
              userId,
              allocationId: cfg.allocationId,
              amount: cfg.amount,
              date: cfg.date,
              description: desc,
              registrationCode,
            },
            select: { id: true },
          })
          txId = created.id
        }

        let receipt = await tx.receipt.findFirst({
          where: { transactionId: txId },
          select: { id: true },
        })
        if (!receipt) {
          receipt = await tx.receipt.create({
            data: {
              transactionId: txId,
              userId,
              familyId,
              fileUrl: DATA_URL_RECEIPT,
            },
            select: { id: true },
          })
        }
        receiptIds.push(receipt.id)
      }
    })

    const monthDates = [thisMonthDay(2), thisMonthDay(4), thisMonthDay(6)]
    for (let i = 0; i < receiptIds.length; i++) {
      const r = await prisma.receipt.findUnique({ where: { id: receiptIds[i] }, select: { transactionId: true } })
      if (r?.transactionId) {
        await prisma.transaction.update({
          where: { id: r.transactionId },
          data: { date: monthDates[i] },
        })
      }
      const ext = await prisma.receiptExtraction.findUnique({ where: { receiptId: receiptIds[i] }, select: { id: true } })
      if (ext) {
        await prisma.receiptExtraction.update({
          where: { id: ext.id },
          data: { receiptDate: monthDates[i] },
        })
      }
    }

    let created = 0
    const periodStartDate = periodStart
    const periodEndDate = periodEnd

    const existing0 = await prisma.receiptExtraction.findUnique({ where: { receiptId: receiptIds[0] }, select: { id: true } })
    if (!existing0) {
      await prisma.receiptExtraction.create({
        data: {
          receiptId: receiptIds[0],
          familyId,
          userId,
          merchantName: 'Super Demo',
          receiptDate: thisMonthDay(2),
          total: '1350',
          currency: 'MXN',
          rawText: DEMO_CONSUMPTION_ITEMS.map((i) => `${i.description} ${i.quantity} ${i.quantityUnit}`).join('\n'),
          receiptType: 'retail',
          items: {
            create: DEMO_CONSUMPTION_ITEMS.map((it, idx) => ({
              lineNumber: idx + 1,
              description: it.description,
              rawLine: `${it.description} ${it.quantity} ${it.quantityUnit}`,
              quantity: it.quantity,
              unitPrice: null,
              amount: null,
              isAdjustment: false,
              isPlaceholder: false,
              quantityUnit: it.quantityUnit,
            })),
          },
        },
      })
      created += 1
    }

    const existing1 = await prisma.receiptExtraction.findUnique({ where: { receiptId: receiptIds[1] }, select: { id: true } })
    if (!existing1) {
      await prisma.receiptExtraction.create({
        data: {
          receiptId: receiptIds[1],
          familyId,
          userId,
          merchantName: 'CFE (demo)',
          receiptDate: thisMonthDay(4),
          total: '450',
          currency: 'MXN',
          receiptType: 'utility',
          consumptionQuantity: '285',
          consumptionUnit: 'kWh',
          consumptionPeriodStart: periodStartDate,
          consumptionPeriodEnd: periodEndDate,
        },
      })
      created += 1
    }

    const existing2 = await prisma.receiptExtraction.findUnique({ where: { receiptId: receiptIds[2] }, select: { id: true } })
    if (!existing2) {
      await prisma.receiptExtraction.create({
        data: {
          receiptId: receiptIds[2],
          familyId,
          userId,
          merchantName: 'Agua (demo)',
          receiptDate: thisMonthDay(6),
          total: '120',
          currency: 'MXN',
          receiptType: 'utility',
          consumptionQuantity: '12.5',
          consumptionUnit: 'm3',
          consumptionPeriodStart: periodStartDate,
          consumptionPeriodEnd: periodEndDate,
        },
      })
      created += 1
    }

    return NextResponse.json({
      ok: true,
      message: created > 0 ? `Datos de consumo creados (${created} extracciones).` : 'Los datos de consumo ya existían.',
      created,
    })
  } catch (e: any) {
    return jsonError(e?.message || 'Error al crear datos de consumo', 500)
  }
}
