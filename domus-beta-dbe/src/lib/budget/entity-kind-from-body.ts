import { EntityKind } from '@/generated/prisma/client'

/** Acepta EntityKind nuevo o valores legados del antiguo enum. */
export function entityKindAndSubtypeFromBody(typeRaw: unknown, customTypeId: string | null): { kind: EntityKind; subtype: string | null } {
  const t = typeof typeRaw === 'string' ? typeRaw.trim() : ''
  if (t === 'FAMILY') return { kind: EntityKind.FAMILY, subtype: null }
  if (t === 'PERSON') return { kind: EntityKind.PERSON, subtype: null }
  if (t === 'PET') return { kind: EntityKind.PET, subtype: null }
  if (t === 'ASSET') return { kind: EntityKind.ASSET, subtype: null }
  if (customTypeId) return { kind: EntityKind.ASSET, subtype: null }
  // legado
  if (t === 'HOUSE') return { kind: EntityKind.ASSET, subtype: 'casa' }
  if (t === 'VEHICLE') return { kind: EntityKind.ASSET, subtype: 'auto' }
  if (t === 'GROUP') return { kind: EntityKind.ASSET, subtype: 'grupo' }
  if (t === 'FUND') return { kind: EntityKind.ASSET, subtype: 'fondo' }
  if (t === 'PROJECT') return { kind: EntityKind.ASSET, subtype: 'proyecto' }
  if (t === 'OTHER') return { kind: EntityKind.ASSET, subtype: 'otro' }
  return { kind: EntityKind.ASSET, subtype: null }
}

export function entityKindRequiresOwner(kind: EntityKind, subtype: string | null): boolean {
  if (kind === EntityKind.PET) return true
  if (kind === EntityKind.ASSET && (subtype === 'auto' || subtype === 'vehiculo' || subtype === 'moto')) return true
  return false
}
