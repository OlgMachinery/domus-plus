import { createClient } from '@/lib/supabase/server'

/**
 * Obtiene el usuario actual autenticado
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !authUser) {
    return null
  }

  // Obtener datos del usuario desde la tabla users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (userError || !userData) {
    return null
  }

  return userData
}

/**
 * Verifica si el usuario está autenticado
 */
export async function isAuthenticated() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}
