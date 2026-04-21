import { prisma } from '@/lib/db/prisma'

import { BASE_SERVICES } from '@/lib/budget/service-catalog'

/** Inserta servicios globales del catálogo (idempotente por nombre único). */
export async function seedGlobalServicesIfNeeded() {
  for (const s of BASE_SERVICES) {
    await prisma.service.upsert({
      where: { name: s.name },
      create: {
        name: s.name,
        categoryGroup: s.categoryGroup,
        isActive: true,
      },
      update: { categoryGroup: s.categoryGroup, isActive: true },
    })
  }
}
