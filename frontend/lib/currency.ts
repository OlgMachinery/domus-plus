/**
 * Utilidades para formateo de moneda
 * Formatea montos en pesos mexicanos (MXN)
 */

import type { Language } from './i18n'

/**
 * Formatea un monto como moneda mexicana (MXN)
 * @param amount - Monto a formatear
 * @param language - Idioma para el formato (es-MX o en-US)
 * @param showDecimals - Si se muestran decimales (default: false)
 * @returns String formateado como "$1,234 MXN" o "$1,234.56 MXN"
 */
export function formatCurrency(amount: number, language: Language = 'es', showDecimals: boolean = false): string {
  const locale = language === 'es' ? 'es-MX' : 'en-US'
  const safeAmount = Number.isFinite(amount) ? amount : 0
  // Mostrar decimales automáticamente si el monto tiene centavos (evita redondear 0.57 -> 1).
  const hasCents = Math.round(Math.abs(safeAmount) * 100) % 100 !== 0
  const useDecimals = showDecimals || hasCents
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0
  }
  
  const formatted = safeAmount.toLocaleString(locale, options)
  return `$${formatted} MXN`
}

/**
 * Formatea un monto como moneda mexicana sin el símbolo MXN (para casos donde ya está claro)
 * Útil cuando el contexto ya indica que es MXN
 * @param amount - Monto a formatear
 * @param language - Idioma para el formato
 * @param showDecimals - Si se muestran decimales
 * @returns String formateado como "$1,234"
 */
export function formatCurrencySimple(amount: number, language: Language = 'es', showDecimals: boolean = false): string {
  const locale = language === 'es' ? 'es-MX' : 'en-US'
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const hasCents = Math.round(Math.abs(safeAmount) * 100) % 100 !== 0
  const useDecimals = showDecimals || hasCents
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0
  }
  
  const formatted = safeAmount.toLocaleString(locale, options)
  return `$${formatted} MXN`
}
