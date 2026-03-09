import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type AuthResult =
  | { ok: true; userId: string; familyId: number; isAdmin: boolean }
  | { ok: false; status: number; body: { detail: string } }

export async function requireSetupAdmin(request?: NextRequest): Promise<AuthResult> {
  const supabase = await createClient()
  const authHeader = request?.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null

  let authUser: { id: string } | null = null
  let authError: Error | null = null

  if (token) {
    const result = await supabase.auth.getUser(token)
    authUser = result.data?.user ?? null
  }
  if (!authUser) {
    const result = await supabase.auth.getUser()
    authUser = result.data?.user ?? null
    authError = result.error
  }

  if (!authUser) {
    return { ok: false, status: 401, body: { detail: 'No autenticado' } }
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('family_id, is_family_admin')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.family_id) {
    return { ok: false, status: 400, body: { detail: 'Usuario sin familia. Completa el Paso 1.' } }
  }

  if (!userRow.is_family_admin) {
    return { ok: false, status: 403, body: { detail: 'Solo el administrador puede configurar el plan.' } }
  }

  return {
    ok: true,
    userId: authUser.id,
    familyId: userRow.family_id,
    isAdmin: true,
  }
}
