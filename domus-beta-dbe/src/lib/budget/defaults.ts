import { EntityType, Prisma } from '@/generated/prisma/client'

export const DEFAULT_BUDGET_ENTITIES: {
  name: string
  type: EntityType
  participatesInBudget: boolean
  participatesInReports: boolean
}[] = [
  { name: 'Persona 1', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Persona 2', type: EntityType.PERSON, participatesInBudget: true, participatesInReports: true },
  { name: 'Comida (Familia)', type: EntityType.GROUP, participatesInBudget: true, participatesInReports: true },
  { name: 'Casa', type: EntityType.HOUSE, participatesInBudget: true, participatesInReports: true },
  { name: 'Auto', type: EntityType.VEHICLE, participatesInBudget: true, participatesInReports: true },
  { name: 'Mascota', type: EntityType.PET, participatesInBudget: true, participatesInReports: true },
  { name: 'Fondo de emergencia', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  { name: 'Ahorro', type: EntityType.FUND, participatesInBudget: true, participatesInReports: true },
  { name: 'Vacaciones', type: EntityType.PROJECT, participatesInBudget: true, participatesInReports: true },
]

export async function seedDefaultBudgetEntitiesForFamily(tx: Prisma.TransactionClient, familyId: string) {
  const existing = await tx.budgetEntity.count({ where: { familyId } })
  if (existing > 0) return { created: 0, skipped: true }

  await tx.budgetEntity.createMany({
    data: DEFAULT_BUDGET_ENTITIES.map((e) => ({
      familyId,
      name: e.name,
      type: e.type,
      isActive: true,
      participatesInBudget: e.participatesInBudget,
      participatesInReports: e.participatesInReports,
    })),
  })

  return { created: DEFAULT_BUDGET_ENTITIES.length, skipped: false }
}

