#!/usr/bin/env npx tsx
/**
 * Antes de `prisma db push` en BD existente:
 * - Asegura tablas services / entity_services / budget_accounts si el SQLite es antiguo.
 * - Rellena `transactions.budget_account_id` (allocation_id legado, luego cuenta por familia).
 *
 * Uso en VPS:
 *   npx tsx scripts/migrate-sqlite-transactions-budget-account.ts
 */
import { randomUUID } from 'crypto'
import 'dotenv/config'

/** Literal SQL en SQLite (comillas simples; no usar JSON.stringify: las comillas dobles son identificadores). */
function sq(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

type PrismaRaw = {
  $executeRawUnsafe: (q: string) => Promise<unknown>
  $queryRawUnsafe: (q: string) => Promise<unknown>
}

async function tableExists(prisma: PrismaRaw, name: string) {
  const r = (await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=${sq(name)}`,
  )) as { name: string }[]
  return r.length > 0
}

async function ensureFamilyEntityTypesTable(prisma: PrismaRaw) {
  if (await tableExists(prisma, 'family_entity_types')) {
    return
  }
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "family_entity_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_entity_types_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE
)`)
  console.log('[migrate] Creada tabla family_entity_types.')
}

/**
 * VPS antigua puede no tener `entities` (modelo F1); entity_services/budget_accounts la referencian.
 * Debe ejecutarse ANTES de crear esas tablas o insertar filas.
 */
async function ensureEntitiesTable(prisma: PrismaRaw) {
  if (await tableExists(prisma, 'entities')) {
    return
  }
  await ensureFamilyEntityTypesTable(prisma)
  await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "family_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "custom_type_id" TEXT,
    "name" TEXT NOT NULL,
    "subtype" TEXT,
    "parent_id" TEXT,
    "owner_entity_id" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "participates_in_budget" BOOLEAN NOT NULL DEFAULT true,
    "participates_in_reports" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entities_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entities_custom_type_id_fkey" FOREIGN KEY ("custom_type_id") REFERENCES "family_entity_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "entities_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "entities_owner_entity_id_fkey" FOREIGN KEY ("owner_entity_id") REFERENCES "entities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
)`)
  console.log('[migrate] Creada tabla entities.')
}

/** Una entidad raíz FAMILY por hogar (misma regla que ensureFamilyRootEntity). */
async function seedFamilyRootEntities(prisma: PrismaRaw) {
  if (!(await tableExists(prisma, 'Family'))) {
    console.warn('[migrate] No hay tabla Family; se omite seed de entidades raíz.')
    return
  }
  const families = (await prisma.$queryRawUnsafe(`SELECT id FROM Family`)) as { id: string }[]
  for (const { id: familyId } of families) {
    const has = (await prisma.$queryRawUnsafe(
      `SELECT id FROM entities WHERE family_id = ${sq(familyId)} LIMIT 1`,
    )) as { id: string }[]
    if (has.length > 0) continue
    const eid = randomUUID()
    await prisma.$executeRawUnsafe(`
      INSERT INTO entities (id, family_id, type, name, is_active, participates_in_budget, participates_in_reports, created_at, updated_at)
      VALUES (${sq(eid)}, ${sq(familyId)}, 'FAMILY', 'Familia', 1, 1, 1, datetime('now'), datetime('now'))
    `)
    console.log(`[migrate] Entidad raíz «Familia» creada para hogar ${familyId}.`)
  }
}

/** DDL alineado con Prisma (@@map: services, entity_services, budget_accounts). */
async function ensureBudgetStackTables(prisma: PrismaRaw) {
  if (!(await tableExists(prisma, 'services'))) {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category_group" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`)
    console.log('[migrate] Creada tabla services.')
  }

  if (!(await tableExists(prisma, 'entity_services'))) {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "entity_services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "family_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entity_services_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_services_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`)
    console.log('[migrate] Creada tabla entity_services.')
  }

  if (!(await tableExists(prisma, 'budget_accounts'))) {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "budget_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "family_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "monthly_limit" DECIMAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "default_payment_method" TEXT,
    "bank_account_label" TEXT,
    "provider_clabe" TEXT,
    "provider_reference" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budget_accounts_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "Family" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_accounts_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`)
    console.log('[migrate] Creada tabla budget_accounts.')
  }
}

async function main() {
  const { prisma } = await import('../src/lib/db/prisma')

  const cols = (await prisma.$queryRawUnsafe(`PRAGMA table_info('transactions');`)) as { name: string }[]
  const colNames = new Set(cols.map((c) => c.name))

  const hasBa = colNames.has('budget_account_id')
  const hasAlloc = colNames.has('allocation_id')

  if (!hasBa) {
    await prisma.$executeRawUnsafe(`ALTER TABLE transactions ADD COLUMN budget_account_id TEXT`)
    console.log('[migrate] Columna budget_account_id añadida (nullable).')
  }

  /** Orden: family_entity_types + entities → services / entity_services / budget_accounts. */
  await ensureEntitiesTable(prisma)
  await seedFamilyRootEntities(prisma)
  await ensureBudgetStackTables(prisma)

  if (hasAlloc) {
    await prisma.$executeRawUnsafe(
      `UPDATE transactions SET budget_account_id = allocation_id WHERE (budget_account_id IS NULL OR trim(budget_account_id) = '') AND allocation_id IS NOT NULL AND trim(allocation_id) != ''`,
    )
    console.log('[migrate] Copiado allocation_id → budget_account_id donde aplicaba.')
  }

  // Si allocation_id apuntaba a ids del esquema antiguo, no existirán en budget_accounts: limpiar.
  await prisma.$executeRawUnsafe(`
    UPDATE transactions SET budget_account_id = NULL
    WHERE budget_account_id IS NOT NULL
    AND trim(budget_account_id) != ''
    AND NOT EXISTS (SELECT 1 FROM budget_accounts ba WHERE ba.id = transactions.budget_account_id)
  `)
  console.log('[migrate] Limpiados budget_account_id que no existían en budget_accounts.')

  await prisma.$executeRawUnsafe(`
    UPDATE transactions SET budget_account_id = (
      SELECT ba.id FROM budget_accounts ba
      WHERE ba.family_id = transactions.family_id
      ORDER BY ba.created_at ASC
      LIMIT 1
    )
    WHERE (budget_account_id IS NULL OR trim(budget_account_id) = '')
    AND EXISTS (SELECT 1 FROM budget_accounts ba2 WHERE ba2.family_id = transactions.family_id)
  `)

  const svcCount = (await prisma.$queryRawUnsafe(`SELECT COUNT(*) as n FROM services`)) as { n: bigint }[]
  if (Number(svcCount[0]?.n ?? 0) === 0) {
    const sid = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO services (id, name, category_group, is_active, created_at) VALUES (${sq(sid)}, 'General', 'legal', 1, datetime('now'))`,
    )
    console.log('[migrate] Insertado servicio «General» (catálogo vacío).')
  }

  const general = await prisma.service.findFirst({
    where: { name: 'General' },
    select: { id: true },
  })
  const serviceId =
    general?.id ??
    (
      await prisma.service.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
    )?.id

  if (!serviceId) throw new Error('[migrate] No hay ningún servicio en catálogo.')

  const familiesNeeding = (await prisma.$queryRawUnsafe(`
    SELECT DISTINCT family_id FROM transactions
    WHERE budget_account_id IS NULL OR trim(budget_account_id) = ''
       OR NOT EXISTS (SELECT 1 FROM budget_accounts b WHERE b.id = transactions.budget_account_id)
  `)) as { family_id: string }[]

  for (const row of familiesNeeding) {
    const familyId = row.family_id
    const existing = (await prisma.$queryRawUnsafe(
      `SELECT id FROM budget_accounts WHERE family_id = ${sq(familyId)} LIMIT 1`,
    )) as { id: string }[]
    if (existing.length > 0) continue

    const ent = (await prisma.$queryRawUnsafe(
      `SELECT id FROM entities WHERE family_id = ${sq(familyId)} ORDER BY created_at ASC LIMIT 1`,
    )) as { id: string }[]
    if (!ent.length) {
      console.warn(`[migrate] Familia ${familyId} sin entidades; no se puede crear cuenta.`)
      continue
    }
    const entityId = ent[0].id
    const esId = randomUUID()
    const baId = randomUUID()

    await prisma.$executeRawUnsafe(`
      INSERT OR IGNORE INTO entity_services (id, family_id, entity_id, service_id, is_active, created_at, updated_at)
      VALUES (${sq(esId)}, ${sq(familyId)}, ${sq(entityId)}, ${sq(serviceId)}, 1, datetime('now'), datetime('now'))
    `)

    await prisma.$executeRawUnsafe(`
      INSERT INTO budget_accounts (id, family_id, entity_id, service_id, monthly_limit, is_active, created_at, updated_at)
      VALUES (${sq(baId)}, ${sq(familyId)}, ${sq(entityId)}, ${sq(serviceId)}, 0, 1, datetime('now'), datetime('now'))
    `)

    await prisma.$executeRawUnsafe(
      `UPDATE transactions SET budget_account_id = ${sq(baId)} WHERE family_id = ${sq(familyId)} AND (budget_account_id IS NULL OR trim(budget_account_id) = '')`,
    )
    console.log(`[migrate] Cuenta de respaldo creada para familia ${familyId}.`)
  }

  // Último paso: cualquier fila siga null
  await prisma.$executeRawUnsafe(`
    UPDATE transactions SET budget_account_id = (
      SELECT ba.id FROM budget_accounts ba
      WHERE ba.family_id = transactions.family_id
      ORDER BY ba.created_at ASC
      LIMIT 1
    )
    WHERE (budget_account_id IS NULL OR trim(budget_account_id) = '')
    AND EXISTS (SELECT 1 FROM budget_accounts ba2 WHERE ba2.family_id = transactions.family_id)
  `)

  const nullRows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as n FROM transactions WHERE budget_account_id IS NULL OR trim(budget_account_id) = ''`,
  )) as { n: bigint }[]
  const nLeft = Number(nullRows[0]?.n ?? 0)
  if (nLeft > 0) {
    throw new Error(
      `[migrate] Quedan ${nLeft} transacciones sin budget_account_id (familias sin entidades o sin poder crear cuenta).`,
    )
  }

  const badFk = (await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as n FROM transactions t
    WHERE NOT EXISTS (SELECT 1 FROM budget_accounts b WHERE b.id = t.budget_account_id)
  `)) as { n: bigint }[]
  if (Number(badFk[0]?.n ?? 0) > 0) {
    throw new Error('[migrate] Hay transacciones con budget_account_id que no existe en budget_accounts.')
  }

  console.log('[migrate] OK. Siguiente paso: prisma db push.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
