import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getAuthUser = async (supabase: Awaited<ReturnType<typeof createClient>>, request: NextRequest) => {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null
  if (token) {
    const result = await supabase.auth.getUser(token)
    if (!result.error && result.data.user) return result
  }
  return supabase.auth.getUser()
}

/** Obtiene family_id e is_family_admin del usuario; si RLS bloquea (p. ej. sesión solo Bearer), usa service role. */
async function getUserFamilyRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ family_id: number | null; is_family_admin: boolean } | null> {
  const { data } = await supabase
    .from('users')
    .select('family_id, is_family_admin')
    .eq('id', userId)
    .single()
  if (data) return { family_id: data.family_id ?? null, is_family_admin: data.is_family_admin ?? false }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[families] SUPABASE_SERVICE_ROLE_KEY no configurada; no se puede verificar acceso con sesión Bearer.')
    return null
  }
  const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: adminData } = await admin.from('users').select('family_id, is_family_admin').eq('id', userId).single()
  if (!adminData) return null
  return { family_id: adminData.family_id ?? null, is_family_admin: adminData.is_family_admin ?? false }
}

const FAMILY_ACCESS_DENIED = { detail: 'No tienes acceso a esta familia' as const }

function sameFamily(a: number | null, b: number | string): boolean {
  const id = Number(b)
  return Number.isInteger(id) && a !== null && Number(a) === id
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const rawId = params?.id ?? ''
    const familyId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN
    if (!Number.isInteger(familyId) || familyId < 1) {
      return NextResponse.json(
        { detail: 'No se pudo cargar la familia. Vuelve al Paso 1 o recarga la página.' },
        { status: 404 }
      )
    }

    // Intentar con Bearer primero, luego con cookies
    let authUser: { id: string } | null = null
    const withBearer = await getAuthUser(supabase, request)
    if (!withBearer.error && withBearer.data.user) authUser = withBearer.data.user
    if (!authUser) {
      const withCookies = await supabase.auth.getUser()
      if (!withCookies.error && withCookies.data.user) authUser = withCookies.data.user
    }
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const userRole = await getUserFamilyRole(supabase, authUser.id)
    if (!userRole) {
      return NextResponse.json(
        {
          detail:
            'No se pudo verificar tu acceso. Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY en .env.local (servidor). Cierra sesión, vuelve a entrar y repite el paso 1 si creaste la familia.',
        },
        { status: 403 }
      )
    }
    if (!sameFamily(userRole.family_id, familyId)) {
      return NextResponse.json(FAMILY_ACCESS_DENIED, { status: 403 })
    }

    let family: unknown = null
    let err: { message: string; code?: string } | null = null
    const res = await supabase
      .from('families')
      .select(`
        *,
        members:users!users_family_id_fkey(*)
      `)
      .eq('id', familyId)
      .single()
    family = res.data
    err = res.error

    // Si RLS bloquea (p. ej. sesión solo Bearer), cargar con service role ya que acceso ya validado
    if ((err || !family) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const adminRes = await admin
        .from('families')
        .select(`*, members:users!users_family_id_fkey(*)`)
        .eq('id', familyId)
        .single()
      if (adminRes.data) family = adminRes.data
      if (!err && adminRes.error) err = adminRes.error
    }

    if (err) {
      if (err.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Familia no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener familia: ${err.message}` },
        { status: 500 }
      )
    }
    if (!family) {
      return NextResponse.json(
        { detail: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(family, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/families/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener familia: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const familyId = parseInt(params.id, 10)
    const body = await request.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const addressPayload = {
      address_line1: typeof body?.address_line1 === 'string' && body.address_line1.trim() ? body.address_line1.trim() : null,
      address_line2: typeof body?.address_line2 === 'string' && body.address_line2.trim() ? body.address_line2.trim() : null,
      city: typeof body?.city === 'string' && body.city.trim() ? body.city.trim() : null,
      state: typeof body?.state === 'string' && body.state.trim() ? body.state.trim() : null,
      postal_code: typeof body?.postal_code === 'string' && body.postal_code.trim() ? body.postal_code.trim() : null,
      country: typeof body?.country === 'string' && body.country.trim() ? body.country.trim() : null,
    }
    const currency = typeof body?.currency === 'string' && body.currency.trim() ? body.currency.trim() : undefined
    const cutoffDay = typeof body?.cutoff_day === 'number' && body.cutoff_day >= 1 && body.cutoff_day <= 31 ? body.cutoff_day : undefined
    const budgetStartDate = typeof body?.budget_start_date === 'string' && body.budget_start_date ? body.budget_start_date : undefined

    if (!name && currency === undefined && cutoffDay === undefined && budgetStartDate === undefined && !Object.values(addressPayload).some(Boolean)) {
      return NextResponse.json(
        { detail: 'Se requiere al menos un campo para actualizar' },
        { status: 400 }
      )
    }

    let authUser: { id: string } | null = null
    const withBearer = await getAuthUser(supabase, request)
    if (!withBearer.error && withBearer.data.user) authUser = withBearer.data.user
    if (!authUser) {
      const withCookies = await supabase.auth.getUser()
      if (!withCookies.error && withCookies.data.user) authUser = withCookies.data.user
    }
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const userRole = await getUserFamilyRole(supabase, authUser.id)
    if (!userRole) {
      return NextResponse.json(
        {
          detail:
            'No se pudo verificar tu acceso. Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY en .env.local (servidor). Cierra sesión, vuelve a entrar y repite el paso 1 si creaste la familia.',
        },
        { status: 403 }
      )
    }
    if (!userRole.family_id || !sameFamily(userRole.family_id, familyId)) {
      return NextResponse.json(FAMILY_ACCESS_DENIED, { status: 403 })
    }
    if (!userRole.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede editar la familia' },
        { status: 403 }
      )
    }

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name) updatePayload.name = name
    Object.assign(updatePayload, addressPayload)
    if (currency !== undefined) updatePayload.currency = currency
    if (cutoffDay !== undefined) updatePayload.cutoff_day = cutoffDay
    if (budgetStartDate !== undefined) updatePayload.budget_start_date = budgetStartDate

    const client =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
          )
        : supabase
    const { data: updated, error } = await client
      .from('families')
      .update(updatePayload)
      .eq('id', familyId)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json(
        { detail: `Error al actualizar familia: ${error?.message || 'Desconocido'}` },
        { status: 500 }
      )
    }

    return NextResponse.json(updated, { status: 200 })
  } catch (error: any) {
    console.error('Error en PATCH /api/families/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar familia: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const familyId = parseInt(params.id, 10)

    let authUser: { id: string } | null = null
    const withBearer = await getAuthUser(supabase, request)
    if (!withBearer.error && withBearer.data.user) authUser = withBearer.data.user
    if (!authUser) {
      const withCookies = await supabase.auth.getUser()
      if (!withCookies.error && withCookies.data.user) authUser = withCookies.data.user
    }
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const userRole = await getUserFamilyRole(supabase, authUser.id)
    if (!userRole) {
      return NextResponse.json(
        {
          detail:
            'No se pudo verificar tu acceso. Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY en .env.local (servidor). Cierra sesión, vuelve a entrar y repite el paso 1 si creaste la familia.',
        },
        { status: 403 }
      )
    }
    if (!userRole.family_id || !sameFamily(userRole.family_id, familyId)) {
      return NextResponse.json(FAMILY_ACCESS_DENIED, { status: 403 })
    }
    if (!userRole.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede eliminar la familia' },
        { status: 403 }
      )
    }

    const client =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
          )
        : supabase
    const { error } = await client.from('families').delete().eq('id', familyId)

    if (error) {
      return NextResponse.json(
        { detail: `Error al eliminar familia: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error en DELETE /api/families/[id]:', error)
    return NextResponse.json(
      { detail: `Error al eliminar familia: ${error.message}` },
      { status: 500 }
    )
  }
}
