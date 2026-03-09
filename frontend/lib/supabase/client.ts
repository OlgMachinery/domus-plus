import { createBrowserClient } from '@supabase/ssr'

// IMPORTANTE: En el cliente solo se usa la anon key (pública). NUNCA uses
// SUPABASE_SERVICE_ROLE_KEY aquí: expondría permisos totales y el login puede fallar.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || ''

/** True si en build time había URL y anon key (en Vercel: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY). */
export const isSupabaseConfigured = !!(url && key)

export function createClient() {
  if (!url || !key) {
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key')
  }
  return createBrowserClient(url, key)
}

export const supabase = createClient()
