import { EntityKind, Prisma } from '@/generated/prisma/client'

export const DEFAULT_BUDGET_ENTITIES: {
  name: string
  type: EntityKind
  subtype: string | null
  participatesInBudget: boolean
  participatesInReports: boolean
}[] = [
  { name: 'Persona 1', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Persona 2', type: EntityKind.PERSON, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Comida (Familia)', type: EntityKind.ASSET, subtype: 'familia', participatesInBudget: true, participatesInReports: true },
  { name: 'Casa', type: EntityKind.ASSET, subtype: 'casa', participatesInBudget: true, participatesInReports: true },
  { name: 'Auto', type: EntityKind.ASSET, subtype: 'auto', participatesInBudget: true, participatesInReports: true },
  { name: 'Mascota', type: EntityKind.PET, subtype: null, participatesInBudget: true, participatesInReports: true },
  { name: 'Fondo de emergencia', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Ahorro', type: EntityKind.ASSET, subtype: 'fondo', participatesInBudget: true, participatesInReports: true },
  { name: 'Vacaciones', type: EntityKind.ASSET, subtype: 'viaje', participatesInBudget: true, participatesInReports: true },
]

export async function seedDefaultBudgetEntitiesForFamily(tx: Prisma.TransactionClient, familyId: string) {
  const existing = await tx.entity.count({ where: { familyId } })
  if (existing > 0) return { created: 0, skipped: true }

  await tx.entity.createMany({
    data: DEFAULT_BUDGET_ENTITIES.map((e) => ({
      familyId,
      name: e.name,
      type: e.type,
      subtype: e.subtype,
      isActive: true,
      participatesInBudget: e.participatesInBudget,
      participatesInReports: e.participatesInReports,
    })),
  })

  return { created: DEFAULT_BUDGET_ENTITIES.length, skipped: false }
}
