import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Durante el build de Vercel, cookies() lanza DYNAMIC_SERVER_USAGE. Usar store vacío para no romper el build.
  let cookieStore: Awaited<ReturnType<typeof cookies>>
  try {
    cookieStore = await cookies()
  } catch {
    cookieStore = { getAll: () => [], setAll: () => {} } as Awaited<ReturnType<typeof cookies>>
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            if (typeof (cookieStore as any).setAll === 'function') {
              (cookieStore as any).setAll(cookiesToSet)
            }
          } catch {
            // Server Component context - middleware handles session refresh
          }
        },
      },
    }
  )
}

export async function getServerUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function requireUser() {
  const user = await getServerUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
