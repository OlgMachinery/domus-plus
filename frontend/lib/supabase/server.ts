import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function createClient(request?: NextRequest) {
  // Si hay un request (API route), usar sus cookies directamente
  if (request) {
    // Obtener todas las cookies del request
    const requestCookies = request.cookies.getAll()
    
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            // Retornar cookies del request
            return requestCookies
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            // En API routes, no podemos establecer cookies directamente
            // El middleware se encarga de esto
            // Pero podemos loggear para diagnóstico
            if (cookiesToSet.length > 0) {
              console.log('🔧 Supabase intentó establecer cookies:', cookiesToSet.map(c => c.name).join(', '))
            }
          },
        },
      }
    )
  }

  // Para Server Components, usar cookies() de next/headers
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Las cookies pueden no estar disponibles en algunos contextos
          }
        },
      },
    }
  )
}
