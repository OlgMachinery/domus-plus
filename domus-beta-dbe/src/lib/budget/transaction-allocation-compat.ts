/** Formato que esperaba el cliente (`allocation` = cuenta + entity + category). */
export function mapBudgetAccountToLegacyAllocationShape(a: {
  id: string
  entity: { id: string; name: string; type: string }
  service: { id: string; name: string }
}) {
  return {
    id: a.id,
    entity: a.entity,
    category: {
      id: a.service.id,
      name: a.service.name,
      type: 'SERVICE',
    },
  }
}
