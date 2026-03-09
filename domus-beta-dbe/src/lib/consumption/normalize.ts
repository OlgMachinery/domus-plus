/**
 * Normalización de productos y unidades para reportes de consumo y precios.
 * Reutilizado por consumption, prices y price-analysis.
 */

/** Normaliza nombre de producto: acentos, espacios, variantes 1L/1 L, quita precios al final. */
export function normalizeProductName(desc: string): string {
  let s = String(desc || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .replace(/\s+/g, ' ')
  s = s.replace(/\b1\s*l\b/gi, '1l').replace(/\b1\s*lt\b/gi, '1l').replace(/\b1\s*litro\b/gi, '1l')
  s = s.replace(/\b(\d+)\s*l\b/gi, '$1l').replace(/\b(\d+)\s*lt\b/gi, '$1l').replace(/\b(\d+)\s*ml\b/gi, '$1ml')
  s = s.replace(/\s+\d+\s+\d+[.,]\d{2}\s+\d+[.,]?\d*$/, '')
  s = s.replace(/\s+\d+[.,]\d{2}\s+\d+[.,]?\d*$/, '')
  s = s.replace(/^\d{5,}\s+/, '')
  return s.slice(0, 80).trim() || 'sin descripción'
}

/** Unifica unidad: 1 L, 1L, 1l → 1l; ml, mL → ml. */
export function normalizeUnit(unit: string): string {
  const u = String(unit || '').trim().toLowerCase().replace(/\s+/g, '')
  if (/^\d+l$/.test(u)) return u
  if (/^\d+ml$/.test(u)) return u
  const m = u.match(/^(\d+)\s*l$/i)
  if (m) return m[1] + 'l'
  return u || '—'
}

export function productKey(description: string, quantityUnit: string): string {
  return `${normalizeProductName(description)}|${normalizeUnit(quantityUnit)}`
}
