import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/prisma'

import { EntityKind } from '@/generated/prisma/client'

/**
 * Garantiza una entidad raíz tipo FAMILY por hogar (nombre "Familia").
 */
export async function ensureFamilyRootEntity(
  tx: Prisma.TransactionClient,
  familyId: string
): Promise<{ id: string }> {
  const existing = await tx.entity.findFirst({
    where: { familyId, type: EntityKind.FAMILY, name: 'Familia' },
    select: { id: true },
  })
  if (existing) return existing
  return tx.entity.create({
    data: {
      familyId,
      type: EntityKind.FAMILY,
      name: 'Familia',
      participatesInBudget: true,
      participatesInReports: true,
    },
    select: { id: true },
  })
}

export async function ensureFamilyRootEntityStandalone(familyId: string) {
  return ensureFamilyRootEntity(prisma, familyId)
}
