/**
 * Detección de datos sensibles en texto (tarjetas, contraseñas) para no persistirlos.
 * C6: Filtro de datos sensibles.
 */

/** Patrón simplificado: 4 grupos de 4 dígitos (con o sin espacios/guiones). No valida Luhn. */
const CARD_PATTERN = /\b(?:\d[\d\s-]*){15,19}\d\b/

/** Palabras que suelen preceder a una contraseña o dato sensible. */
const SENSITIVE_KEYWORDS = /(?:contraseña|password|passwd|pwd|clave|pin|secret|tarjeta|card|cvv|cvc)\s*[:=]\s*[\S]+/i

/**
 * Devuelve true si el texto parece contener datos sensibles (número de tarjeta o contraseña).
 * No persistas el texto tal cual si devuelve true.
 */
export function containsSensitiveData(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()
  if (t.length < 10) return false
  if (CARD_PATTERN.test(t)) return true
  if (SENSITIVE_KEYWORDS.test(t)) return true
  return false
}
