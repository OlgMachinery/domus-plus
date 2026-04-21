#!/usr/bin/env npx tsx
/**
 * Elimina usuarios ficticios (demo+*@domus.local), sus datos y las partidas/categorías
 * de ejemplo (Mamá, Casa, Auto, etc.) creadas por el seed.
 * Uso (desde domus-beta-dbe): npx tsx scripts/clear-fake-data.ts
 * En la VPS: cd /srv/domus/app && npx tsx scripts/clear-fake-data.ts
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

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

async function main() {
  const { prisma } = await import('../src/lib/db/prisma')

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

  if (demoIds.length === 0) {
    console.log('No hay usuarios ficticios (demo+*@domus.local). Comprobando partidas/categorías de ejemplo...')
  } else {
    console.log(`Encontrados ${demoIds.length} usuarios demo. Eliminando datos asociados, partidas y categorías de ejemplo...`)
  }

  const deleted = await prisma.$transaction(async (tx) => {
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
        await tx.receiptExtractionItem.deleteMany({
          where: { extractionId: { in: extractionIds } },
        })
      }
      await tx.receiptExtraction.deleteMany({
        where: { receiptId: { in: receiptIds } },
      })
      await tx.receiptImage.deleteMany({
        where: { receiptId: { in: receiptIds } },
      })
    }

    await tx.receipt.deleteMany({
      where: { userId: { in: demoIds } },
    })

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
    const delMembers = await tx.familyMember.deleteMany({
      where: { userId: { in: demoIds } },
    })
    await tx.entityOwner.deleteMany({
      where: { userId: { in: demoIds } },
    })
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
    await tx.moneyRequest.deleteMany({
      where: { createdByUserId: { in: demoIds } },
    })
    const delUsers = await tx.user.deleteMany({
      where: { id: { in: demoIds } },
    })

    let budgetEntities = 0
    let budgetCategories = 0
    let allocations = 0
    let transactionsFromSeedAllocations = 0
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
        transactionsFromSeedAllocations = delTxAlloc.count
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
      transactions: delTx.count + transactionsFromSeedAllocations,
      familyMembers: delMembers.count,
      budgetEntities,
      budgetCategories,
      allocations,
    }
  })

  console.log('Listo. Eliminados:', deleted)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
