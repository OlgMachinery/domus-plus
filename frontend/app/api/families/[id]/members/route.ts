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

async function getUserFamilyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number | null> {
  const { data } = await supabase.from('users').select('family_id').eq('id', userId).single()
  if (data?.family_id != null) return data.family_id
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: adminData } = await admin.from('users').select('family_id').eq('id', userId).single()
  return adminData?.family_id ?? null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const familyId = parseInt(params.id)

    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const userFamilyId = await getUserFamilyId(supabase, authUser.id)
    if (userFamilyId !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    let members: unknown[] | null = null
    let err: { message: string } | null = null
    const res = await supabase.from('users').select('*').eq('family_id', familyId).order('name')
    members = res.data
    err = res.error
    if ((err || !members) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const adminRes = await admin.from('users').select('*').eq('family_id', familyId).order('name')
      if (adminRes.data) members = adminRes.data
      if (!err && adminRes.error) err = adminRes.error
    }

    if (err) {
      console.error('Error obteniendo miembros:', err)
      return NextResponse.json(
        { detail: `Error al obtener miembros: ${err.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(members || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/families/[id]/members:', error)
    return NextResponse.json(
      { detail: `Error al obtener miembros: ${error.message}` },
      { status: 500 }
    )
  }
}
