#!/usr/bin/env npx tsx
/**
 * Seed de demostración local: familia, entidades, catálogo de servicios,
 * entity_services y budget_accounts (límite 0, activos).
 * Uso (desde domus-beta-dbe): npx tsx scripts/seed-local-demo.ts
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

import { BASE_SERVICES } from '../src/lib/budget/service-catalog'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '..', '.env') })

/** Servicios usados en el demo (subset de BASE_SERVICES; excluye p. ej. General). */
const DEMO_SERVICE_NAMES = BASE_SERVICES.filter((s) => s.name !== 'General').map((s) => s.name)
type ServiceName = (typeof DEMO_SERVICE_NAMES)[number]

const ENTITY_SERVICE_LINKS: Record<string, ServiceName[]> = {
  Jeep: [
    'Gasolina',
    'Reparaciones',
    'Seguro',
    'Placas',
    'Llantas',
    'Lavado',
  ],
  Casa: [
    'Electricidad',
    'Agua',
    'Internet',
    'Mantenimiento',
    'Supermercado',
  ],
  Diego: ['Ropa', 'Ocio', 'Salud'],
  Luna: ['Veterinario', 'Alimento', 'Vacunas', 'Baño'],
  Familia: ['Viajes', 'Donaciones'],
}

async function main() {
  const prismaMod = await import('../src/lib/db/prisma')
  await prismaMod.ensureSqlitePragmas()
  const { prisma } = prismaMod

  console.log('Creando familia y entidades…')
  const budgetStart = new Date()
  budgetStart.setUTCDate(1)
  budgetStart.setUTCHours(0, 0, 0, 0)

  const family = await prisma.family.create({
    data: {
      name: 'Familia demo',
      budgetStartDate: budgetStart,
      setupComplete: false,
    },
  })

  const familiaEntity = await prisma.entity.create({
    data: {
      familyId: family.id,
      type: 'FAMILY',
      name: 'Familia',
      parentId: null,
    },
  })

  const casa = await prisma.entity.create({
    data: {
      familyId: family.id,
      type: 'ASSET',
      name: 'Casa',
      subtype: 'casa',
      parentId: familiaEntity.id,
    },
  })

  const diego = await prisma.entity.create({
    data: {
      familyId: family.id,
      type: 'PERSON',
      name: 'Diego',
      parentId: familiaEntity.id,
    },
  })

  const jeep = await prisma.entity.create({
    data: {
      familyId: family.id,
      type: 'ASSET',
      name: 'Jeep',
      subtype: 'auto',
      parentId: diego.id,
    },
  })

  const luna = await prisma.entity.create({
    data: {
      familyId: family.id,
      type: 'PET',
      name: 'Luna',
      subtype: 'perro',
      parentId: diego.id,
    },
  })

  const entitiesByName: Record<string, string> = {
    Familia: familiaEntity.id,
    Casa: casa.id,
    Diego: diego.id,
    Jeep: jeep.id,
    Luna: luna.id,
  }

  console.log('Insertando servicios globales…')
  const serviceIdByName = new Map<string, string>()
  for (const row of BASE_SERVICES) {
    const s = await prisma.service.upsert({
      where: { name: row.name },
      create: {
        name: row.name,
        categoryGroup: row.categoryGroup,
        isActive: true,
      },
      update: {
        categoryGroup: row.categoryGroup,
        isActive: true,
      },
    })
    serviceIdByName.set(row.name, s.id)
  }

  console.log('Creando entity_services y budget_accounts…')
  for (const [entityLabel, serviceNames] of Object.entries(ENTITY_SERVICE_LINKS)) {
    const entityId = entitiesByName[entityLabel]
    if (!entityId) throw new Error(`Entidad no definida: ${entityLabel}`)

    for (const svcName of serviceNames) {
      const serviceId = serviceIdByName.get(svcName)
      if (!serviceId) throw new Error(`Servicio no definido: ${svcName}`)

      await prisma.entityService.create({
        data: {
          familyId: family.id,
          entityId,
          serviceId,
          isActive: true,
        },
      })

      await prisma.budgetAccount.create({
        data: {
          familyId: family.id,
          entityId,
          serviceId,
          monthlyLimit: 0,
          isActive: true,
        },
      })
    }
  }

  console.log('Verificando integridad…')
  const dupEs = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) as c FROM entity_services
    GROUP BY entity_id, service_id
    HAVING COUNT(*) > 1
  `
  const dupBa = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*) as c FROM budget_accounts
    GROUP BY entity_id, service_id
    HAVING COUNT(*) > 1
  `

  if (dupEs.length > 0 || dupBa.length > 0) {
    throw new Error(
      `Duplicados: grupos repetidos entity_services=${dupEs.length}, budget_accounts=${dupBa.length}`,
    )
  }

  const indexSql = await prisma.$queryRaw<{ sql: string | null }[]>`
    SELECT sql FROM sqlite_master
    WHERE type = 'index' AND tbl_name IN ('entity_services', 'budget_accounts') AND sql IS NOT NULL;
  `
  const uniqueEs = indexSql.some(
    (row) => row.sql && /entity_services/i.test(row.sql) && /unique/i.test(row.sql),
  )
  const uniqueBa = indexSql.some(
    (row) => row.sql && /budget_accounts/i.test(row.sql) && /unique/i.test(row.sql),
  )
  if (!uniqueEs) {
    throw new Error('No se encontró índice UNIQUE en entity_services (entity_id + service_id).')
  }
  if (!uniqueBa) {
    throw new Error('No se encontró índice UNIQUE en budget_accounts (entity_id + service_id).')
  }

  const txCols = await prisma.$queryRaw<{ name: string; notnull: number | bigint }[]>`
    PRAGMA table_info('transactions');
  `
  const budgetAccountCol = txCols.find((c) => c.name === 'budget_account_id')
  const nn = budgetAccountCol != null ? Number(budgetAccountCol.notnull) : -1
  if (!budgetAccountCol || nn !== 1) {
    throw new Error(
      `transactions.budget_account_id debe ser NOT NULL (obligatorio). notnull prisma=${String(budgetAccountCol?.notnull)}`,
    )
  }

  console.log('Listo:', {
    familyId: family.id,
    entities: Object.keys(entitiesByName).length,
    servicesInCatalog: serviceIdByName.size,
    entityServices: await prisma.entityService.count(),
    budgetAccounts: await prisma.budgetAccount.count(),
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
