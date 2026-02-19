/**
 * Helper central para enviar autenticación en llamadas a la API.
 * Usa domus_token (localStorage) o la sesión de Supabase.
 * Todas las páginas que llamen a /api/* deben usar getAuthHeaders() en sus fetch.
 */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('domus_token')
}

/**
 * Devuelve los headers para usar en fetch a la API.
 * Prioridad: domus_token en localStorage → sesión Supabase (y guarda el token en domus_token).
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (typeof window === 'undefined') return headers

  const token = localStorage.getItem('domus_token')
  if (token) {
    headers.Authorization = `Bearer ${token}`
    return headers
  }

  try {
    const { supabase } = await import('@/lib/supabase/client')
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (accessToken) {
      localStorage.setItem('domus_token', accessToken)
      headers.Authorization = `Bearer ${accessToken}`
    }
  } catch {
    // Sin Supabase o sin sesión
  }

  return headers
}
