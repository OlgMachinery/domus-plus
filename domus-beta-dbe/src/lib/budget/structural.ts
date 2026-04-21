import { jsonError } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

export const BUDGET_OBJECT_REQUIRED_DETAIL =
  'Falta el objeto presupuestal: crea al menos 1 objeto activo antes de continuar.'

export async function requireAtLeastOneActiveBudgetObject(familyId: string) {
  const count = await prisma.entity.count({ where: { familyId, isActive: true } })
  if (count >= 1) return null
  return jsonError(BUDGET_OBJECT_REQUIRED_DETAIL, 409)
}

