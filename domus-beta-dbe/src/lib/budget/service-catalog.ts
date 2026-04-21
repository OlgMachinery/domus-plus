/**
 * Catálogo base de servicios (nombre único global).
 * Las reglas de clasificación por EntityKind/subtype se aplican al filtrar en UI.
 */
export const BASE_SERVICES: { name: string; categoryGroup: string }[] = [
  // ASSET — auto
  { name: 'Gasolina', categoryGroup: 'auto' },
  { name: 'Reparaciones', categoryGroup: 'auto' },
  { name: 'Seguro', categoryGroup: 'auto' },
  { name: 'Placas', categoryGroup: 'auto' },
  { name: 'Llantas', categoryGroup: 'auto' },
  { name: 'Lavado', categoryGroup: 'auto' },
  // ASSET — casa / hogar
  { name: 'Electricidad', categoryGroup: 'hogar' },
  { name: 'Agua', categoryGroup: 'hogar' },
  { name: 'Internet', categoryGroup: 'hogar' },
  { name: 'Mantenimiento', categoryGroup: 'hogar' },
  { name: 'Supermercado', categoryGroup: 'hogar' },
  // PERSON
  { name: 'Ropa', categoryGroup: 'persona' },
  { name: 'Ocio', categoryGroup: 'persona' },
  { name: 'Salud', categoryGroup: 'persona' },
  // FAMILY
  { name: 'Viajes', categoryGroup: 'hogar' },
  { name: 'Donaciones', categoryGroup: 'hogar' },
  // PET
  { name: 'Veterinario', categoryGroup: 'mascota' },
  { name: 'Alimento', categoryGroup: 'mascota' },
  { name: 'Vacunas', categoryGroup: 'mascota' },
  { name: 'Baño', categoryGroup: 'mascota' },
  // Legales / otros usados al migrar categorías libres
  { name: 'General', categoryGroup: 'legal' },
]
