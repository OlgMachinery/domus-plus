export type LoginResponse = {
  ok: boolean
  user: { id: string; email: string; name?: string }
  familyId: string | null
  token: string
}

export type FamilyActiveResponse = { family?: { id: string; name?: string } }
export type MembersResponse = { members?: { id: string; name?: string; isFamilyAdmin?: boolean }[] }
export type EntitiesResponse = { entities?: { id: string; name: string; type: string }[] }
export type AllocationsResponse = {
  allocations?: {
    id: string
    entity?: { id: string; name: string; type: string }
    category?: { id: string; name: string; type?: string }
  }[]
}

export type CategoriesResponse = {
  categories?: { id: string; name: string; type?: string; entityId?: string }[]
}

// Solicitudes de dinero (misma API que web para sincronización)
export type MoneyRequestItem = {
  id: string
  familyId: string
  createdByUserId: string
  requestedAt: string
  forEntityId: string | null
  forName: string | null
  allocationId: string | null
  date: string
  reason: string
  amount: string
  currency: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED'
  transactionId: string | null
  registrationCode: string | null
  approvedAt: string | null
  approvedByUserId: string | null
  rejectedAt: string | null
  rejectedByUserId: string | null
  deliveredAt: string | null
  createdAt: string
  createdBy: { id: string; name: string | null; email: string }
  forEntity: { id: string; name: string; type: string } | null
  allocation: {
    id: string
    entity: { id: string; name: string }
    category: { id: string; name: string }
  } | null
}

export type MoneyRequestsResponse = {
  ok: boolean
  moneyRequests: MoneyRequestItem[]
}
