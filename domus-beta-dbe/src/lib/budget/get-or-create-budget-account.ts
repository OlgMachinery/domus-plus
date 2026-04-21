import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/prisma'

/**
 * Obtiene o crea la cuenta presupuestal (destino) para entidad + servicio.
 * Valida family_id y el vínculo entity_service.
 */
export async function getOrCreateBudgetAccount(
  familyId: string,
  entityId: string,
  serviceId: string,
  tx: Prisma.TransactionClient = prisma
) {
  const entity = await tx.entity.findFirst({
    where: { id: entityId, familyId },
    select: { id: true },
  })
  if (!entity) throw new Error('Entidad no encontrada en la familia')

  const es = await tx.entityService.findFirst({
    where: {
      familyId,
      entityId,
      serviceId,
      isActive: true,
    },
    select: { id: true },
  })
  if (!es) {
    throw new Error('El servicio no está asignado a esta entidad (EntityService)')
  }

  const existing = await tx.budgetAccount.findFirst({
    where: { entityId, serviceId },
  })
  if (existing) {
    if (existing.familyId !== familyId) throw new Error('Conflicto de familia en cuenta presupuestal')
    return existing
  }

  return tx.budgetAccount.create({
    data: {
      familyId,
      entityId,
      serviceId,
      monthlyLimit: '0',
      isActive: true,
    },
  })
}
