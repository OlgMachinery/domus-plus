/**
 * Elimina solo los datos ficticios (usuarios demo y todo lo asociado) para dejar
 * el sistema listo para producción. Los usuarios demo tienen email demo+*@domus.local.
 * Solo el super admin (gonzalomail@me.com) puede ejecutar esta acción.
 */
import { NextRequest, NextResponse } from 'next/server'
import { jsonError, requireMembership } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

const SUPER_ADMIN_EMAIL = 'gonzalomail@me.com'

// Nombres de partidas y categorías creados por el seed de datos ficticios (fake-data).
// Deben coincidir con SEED_ENTITIES y SEED_CATEGORIES en fake-data/route.ts.
const SEED_ENTITY_NAMES = [
  'Mamá', 'Papá', 'Laura', 'Sofía', 'Mateo', 'Diego', 'Valeria', 'Emilia', 'Sebastián', 'Daniela', 'Andrés',
  'Casa', 'Comida (Familia)', 'Auto', 'Auto (Mamá)', 'Moto', 'Camioneta', 'Bici familiar',
  'Pelusa', 'Luna', 'Max', 'Nala', 'Rocky', 'Coco',
  'Fondo de emergencia', 'Retiro', 'Educación (Sofía)', 'Educación (Mateo)', 'Inversión', 'Ahorro Navidad', 'Ahorro carro nuevo', 'Vacaciones',
]
const SEED_CATEGORY_NAMES = [
  'Renta / Hipoteca', 'Supermercado', 'Servicios (luz/agua/internet)', 'Internet / Teléfono', 'Limpieza / Hogar',
  'Reparaciones de casa', 'Mantenimiento auto', 'Seguro auto', 'Gasolina', 'Mascotas', 'Veterinario',
  'Colegiaturas', 'Útiles escolares', 'Salud / Doctor', 'Farmacia', 'Ahorro', 'Entretenimiento', 'Restaurantes',
  'Ropa', 'Suscripciones', 'Vacaciones',
]

export async function POST(req: NextRequest) {
  try {
    const { userId, familyId } = await requireMembership(req)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (user?.email !== SUPER_ADMIN_EMAIL) {
      return jsonError('Solo el super administrador puede eliminar datos ficticios.', 403)
    }

    const demoUsers = await prisma.user.findMany({
      where: {
        AND: [
          { email: { startsWith: 'demo+' } },
          { email: { endsWith: '@domus.local' } },
        ],
      },
      select: { id: true, email: true },
    })
    const demoIds = demoUsers.map((u) => u.id)

    const deleted = await prisma.$transaction(async (tx) => {
      let transactions = 0
      let receipts = 0
      let familyMembers = 0
      let receiptExtractionItems = 0
      let receiptExtractions = 0
      let receiptImages = 0
      let budgetEntityOwners = 0
      let moneyRequests = 0
      let budgetEntities = 0
      let budgetCategories = 0
      let allocations = 0

      const familyIdsWithDemo = demoIds.length > 0
        ? await tx.familyMember.findMany({
            where: { userId: { in: demoIds } },
            select: { familyId: true },
          }).then((r) => [...new Set(r.map((x) => x.familyId))])
        : []

      const receiptIds = await tx.receipt.findMany({
        where: { userId: { in: demoIds } },
        select: { id: true },
      }).then((r) => r.map((x) => x.id))

      if (receiptIds.length > 0) {
        const extractionIds = await tx.receiptExtraction.findMany({
          where: { receiptId: { in: receiptIds } },
          select: { id: true },
        }).then((e) => e.map((x) => x.id))
        if (extractionIds.length > 0) {
          const delItems = await tx.receiptExtractionItem.deleteMany({
            where: { extractionId: { in: extractionIds } },
          })
          receiptExtractionItems = delItems.count
        }
        const delExt = await tx.receiptExtraction.deleteMany({
          where: { receiptId: { in: receiptIds } },
        })
        receiptExtractions = delExt.count
        const delImg = await tx.receiptImage.deleteMany({
          where: { receiptId: { in: receiptIds } },
        })
        receiptImages = delImg.count
      }

      const delReceipts = await tx.receipt.deleteMany({
        where: { userId: { in: demoIds } },
      })
      receipts = delReceipts.count

      const demoTransactionIds = await tx.transaction.findMany({
        where: { userId: { in: demoIds } },
        select: { id: true },
      }).then((t) => t.map((x) => x.id))
      if (demoTransactionIds.length > 0) {
        await tx.receiptConfirmationMessage.deleteMany({
          where: { transactionId: { in: demoTransactionIds } },
        })
      }
      const delTx = await tx.transaction.deleteMany({
        where: { userId: { in: demoIds } },
      })
      transactions = delTx.count

      const delMembers = await tx.familyMember.deleteMany({
        where: { userId: { in: demoIds } },
      })
      familyMembers = delMembers.count

      const delOwners = await tx.entityOwner.deleteMany({
        where: { userId: { in: demoIds } },
      })
      budgetEntityOwners = delOwners.count

      await tx.userBudgetSubdivision.deleteMany({
        where: { userId: { in: demoIds } },
      })
      await tx.budgetAdjustmentSuggestion.deleteMany({
        where: { userId: { in: demoIds } },
      })

      await tx.moneyRequest.updateMany({
        where: { approvedByUserId: { in: demoIds } },
        data: { approvedByUserId: null },
      })
      await tx.moneyRequest.updateMany({
        where: { rejectedByUserId: { in: demoIds } },
        data: { rejectedByUserId: null },
      })
      const delRequests = await tx.moneyRequest.deleteMany({
        where: { createdByUserId: { in: demoIds } },
      })
      moneyRequests = delRequests.count

      const delUsers = await tx.user.deleteMany({
        where: { id: { in: demoIds } },
      })

      // Eliminar partidas, categorías y asignaciones ficticias (seed) en familias que tenían demo
      if (familyIdsWithDemo.length > 0) {
        const seedEntities = await tx.entity.findMany({
          where: { familyId: { in: familyIdsWithDemo }, name: { in: SEED_ENTITY_NAMES } },
          select: { id: true },
        })
        const seedEntityIds = seedEntities.map((e) => e.id)
        const seedCategories = await tx.budgetCategory.findMany({
          where: { familyId: { in: familyIdsWithDemo }, name: { in: SEED_CATEGORY_NAMES } },
          select: { id: true },
        })
        const seedCategoryIds = seedCategories.map((c) => c.id)
        const seedServices = await tx.service.findMany({
          where: { name: { in: SEED_CATEGORY_NAMES } },
          select: { id: true },
        })
        const seedServiceIds = seedServices.map((s) => s.id)
        const allocsToRemove = await tx.budgetAccount.findMany({
          where: {
            OR: [
              { entityId: { in: seedEntityIds } },
              ...(seedServiceIds.length ? [{ serviceId: { in: seedServiceIds } }] : []),
            ],
          },
          select: { id: true },
        })
        const allocationIdsToRemove = allocsToRemove.map((a) => a.id)
        if (allocationIdsToRemove.length > 0) {
          const txIdsForAllocs = await tx.transaction.findMany({
            where: { budgetAccountId: { in: allocationIdsToRemove } },
            select: { id: true },
          }).then((t) => t.map((x) => x.id))
          if (txIdsForAllocs.length > 0) {
            await tx.receiptConfirmationMessage.deleteMany({
              where: { transactionId: { in: txIdsForAllocs } },
            })
          }
          const delTxAlloc = await tx.transaction.deleteMany({
            where: { budgetAccountId: { in: allocationIdsToRemove } },
          })
          transactions += delTxAlloc.count
          const delAlloc = await tx.budgetAccount.deleteMany({
            where: { id: { in: allocationIdsToRemove } },
          })
          allocations = delAlloc.count
        }
        const delEnt = await tx.entity.deleteMany({
          where: { id: { in: seedEntityIds } },
        })
        budgetEntities = delEnt.count
        const delCat = await tx.budgetCategory.deleteMany({
          where: { id: { in: seedCategoryIds } },
        })
        budgetCategories = delCat.count
      }

      return {
        users: delUsers.count,
        transactions,
        receipts,
        familyMembers,
        receiptExtractionItems,
        receiptExtractions,
        receiptImages,
        budgetEntityOwners,
        moneyRequests,
        budgetEntities,
        budgetCategories,
        allocations,
      }
    })

    const totalRemoved = deleted.users + deleted.transactions + deleted.budgetEntities + deleted.budgetCategories
    const message = totalRemoved === 0
      ? 'No hay datos ficticios (usuarios demo ni partidas/categorías de ejemplo) que eliminar.'
      : 'Datos ficticios eliminados: usuarios demo, transacciones, partidas (Mamá, Casa, Auto, etc.) y categorías de ejemplo. Listo para producción.'

    return NextResponse.json({
      ok: true,
      message,
      deleted,
    })
  } catch (e: any) {
    console.error('clear-fake-data:', e)
    return jsonError(e?.message || 'No se pudieron eliminar los datos ficticios', 500)
  }
}
