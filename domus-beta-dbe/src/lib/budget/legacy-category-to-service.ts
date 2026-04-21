import type { Prisma } from '@/generated/prisma/client'

/**
 * Convierte una categoría presupuestal legada en un Service del catálogo global (por nombre).
 */
export async function getOrCreateServiceFromBudgetCategoryName(
  tx: Prisma.TransactionClient,
  categoryName: string
): Promise<{ id: string }> {
  const name = categoryName.trim().slice(0, 200)
  if (!name) throw new Error('Nombre de categoría vacío')
  return tx.service.upsert({
    where: { name },
    create: { name, categoryGroup: 'legacy', isActive: true },
    update: {},
    select: { id: true },
  })
}
