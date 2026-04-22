import type { Prisma } from '@/generated/prisma/client'
import { EntityKind } from '@/generated/prisma/client'
import { ensureFamilyRootEntity } from '@/lib/budget/ensure-family-root-entity'
import { BASE_SERVICES } from '@/lib/budget/service-catalog'

const DEMO_PREFIX = 'DOMUS-demo · '

type PreviewSpec = {
  name: string
  type: EntityKind
  subtype: string | null
  /** parent: null = bajo raíz Familia; string = nombre de otra entidad demo (sin prefijo interno) */
  underName: string | null
  serviceNames: string[]
  /** userIds para PET o ASSET auto (responsables) */
  ownerUserIds?: string[]
}

/**
 * Destinos de demostración bajo la raíz Familia, nombres con prefijo DOMUS-demo ·
 * para no pisar datos reales. Idempotente por nombre dentro de la familia.
 */
function previewSpecs(): PreviewSpec[] {
  return [
    {
      name: `${DEMO_PREFIX}Supermercado fam.`,
      type: EntityKind.ASSET,
      subtype: null,
      underName: null,
      serviceNames: ['Supermercado', 'Mantenimiento'],
    },
    {
      name: `${DEMO_PREFIX}Eventos`,
      type: EntityKind.ASSET,
      subtype: 'proyecto',
      underName: null,
      serviceNames: ['Mantenimiento'],
    },
    {
      name: `${DEMO_PREFIX}Casa`,
      type: EntityKind.ASSET,
      subtype: 'casa',
      underName: null,
      serviceNames: ['Electricidad', 'Agua', 'Internet', 'Mantenimiento', 'Supermercado'],
    },
    {
      name: `${DEMO_PREFIX}Ana`,
      type: EntityKind.PERSON,
      subtype: null,
      underName: null,
      serviceNames: ['Ropa', 'Ocio', 'Salud'],
    },
    {
      name: `${DEMO_PREFIX}Auto de Ana`,
      type: EntityKind.ASSET,
      subtype: 'auto',
      underName: `${DEMO_PREFIX}Ana`,
      serviceNames: ['Gasolina', 'Seguro', 'Reparaciones', 'Lavado'],
      ownerUserIds: [], // se rellena en runtime con primer miembro
    },
    {
      name: `${DEMO_PREFIX}Luna (mascota)`,
      type: EntityKind.PET,
      subtype: null,
      underName: `${DEMO_PREFIX}Ana`,
      serviceNames: ['Veterinario', 'Alimento', 'Vacunas'],
      ownerUserIds: [],
    },
    {
      name: `${DEMO_PREFIX}GPS hogar`,
      type: EntityKind.ASSET,
      subtype: null,
      underName: null,
      serviceNames: ['Mantenimiento', 'General'],
    },
  ]
}

async function ensureServices(tx: Prisma.TransactionClient) {
  const ids = new Map<string, string>()
  for (const row of BASE_SERVICES) {
    const s = await tx.service.upsert({
      where: { name: row.name },
      create: { name: row.name, categoryGroup: row.categoryGroup, isActive: true },
      update: { categoryGroup: row.categoryGroup, isActive: true },
      select: { id: true },
    })
    ids.set(row.name, s.id)
  }
  return ids
}

async function linkServices(
  tx: Prisma.TransactionClient,
  familyId: string,
  entityId: string,
  serviceNames: string[],
  serviceIdByName: Map<string, string>,
) {
  for (const nm of serviceNames) {
    const serviceId = serviceIdByName.get(nm)
    if (!serviceId) continue
    await tx.entityService.upsert({
      where: { entityId_serviceId: { entityId, serviceId } },
      create: { familyId, entityId, serviceId, isActive: true },
      update: { isActive: true },
    })
    await tx.budgetAccount.upsert({
      where: { entityId_serviceId: { entityId, serviceId } },
      create: {
        familyId,
        entityId,
        serviceId,
        monthlyLimit: 0,
        isActive: true,
      },
      update: { isActive: true },
    })
  }
}

/**
 * Inserta árbol demo bajo Familia (solo filas con prefijo DOMUS-demo ·).
 * @param defaultOwnerUserId primer integrante para dueños de mascota/auto
 */
export async function seedEntitiesTreePreview(
  tx: Prisma.TransactionClient,
  familyId: string,
  defaultOwnerUserId: string,
): Promise<{ createdEntities: number; skipped: number; linkedServices: number }> {
  const root = await ensureFamilyRootEntity(tx, familyId)
  const serviceIdByName = await ensureServices(tx)

  const specs = previewSpecs()
  const idByFullName = new Map<string, string>()
  idByFullName.set('Familia', root.id)

  const existing = await tx.entity.findMany({
    where: { familyId },
    select: { id: true, name: true },
  })
  for (const e of existing) idByFullName.set(e.name, e.id)

  let createdEntities = 0
  let skipped = 0
  /** Solo enlaces nuevos en esta ejecución (evita inflar el número al re-ejecutar). */
  let linkedServices = 0

  for (const spec of specs) {
    if (idByFullName.has(spec.name)) {
      skipped += 1
      continue
    }
    let parentId: string = root.id
    if (spec.underName) {
      const p = idByFullName.get(spec.underName)
      if (!p) continue
      parentId = p
    }

    const owners: { userId: string; sharePct: number | null }[] = []
    if (spec.type === EntityKind.PET || (spec.type === EntityKind.ASSET && spec.subtype === 'auto')) {
      const uid = spec.ownerUserIds?.[0] || defaultOwnerUserId
      if (uid) owners.push({ userId: uid, sharePct: null })
    }

    const ent = await tx.entity.create({
      data: {
        familyId,
        name: spec.name,
        type: spec.type,
        subtype: spec.subtype,
        parentId,
        participatesInBudget: true,
        participatesInReports: true,
        isActive: true,
      },
      select: { id: true },
    })
    idByFullName.set(spec.name, ent.id)
    createdEntities += 1

    if (owners.length) {
      await tx.entityOwner.createMany({
        data: owners.map((o) => ({
          familyId,
          entityId: ent.id,
          userId: o.userId,
          sharePct: o.sharePct,
        })),
      })
    }

    await linkServices(tx, familyId, ent.id, spec.serviceNames, serviceIdByName)
    linkedServices += spec.serviceNames.length
  }

  // Servicios en la raíz Familia (solo si hubo al menos un destino demo nuevo en esta pasada)
  if (createdEntities > 0) {
    const rootSvcNames = ['Viajes', 'Donaciones', 'Supermercado']
    await linkServices(tx, familyId, root.id, rootSvcNames, serviceIdByName)
    linkedServices += rootSvcNames.length
  }

  return { createdEntities, skipped, linkedServices }
}
