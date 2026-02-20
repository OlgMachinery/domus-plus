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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json([])
    }

    // Obtener familia con miembros
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const canUseAdmin = !!(userData?.is_family_admin && supabaseUrl && serviceRoleKey)
    const queryClient = canUseAdmin
      ? createAdminClient(supabaseUrl!, serviceRoleKey!, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : supabase

    const { data: familyData, error: familyError } = await queryClient
      .from('families')
      .select(`
        *,
        members:users!users_family_id_fkey(*)
      `)
      .eq('id', userData.family_id)
      .single()

    if (familyError) {
      return NextResponse.json(
        { detail: familyError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(familyData)
  } catch (error: any) {
    console.error('Error al obtener familia:', error)
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
    } = body || {}

    if (!name) {
      return NextResponse.json(
        { detail: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar si ya tiene familia
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('family_id, name, email')
      .eq('id', authUser.id)
      .single()

    if (!userError && userData?.family_id) {
      return NextResponse.json(
        { detail: 'El usuario ya tiene una familia asignada', family_id: userData.family_id },
        { status: 200 }
      )
    }

    const familyName =
      typeof name === 'string' && name.trim().length > 0
        ? name.trim()
        : `Familia de ${userData?.name || userData?.email?.split('@')[0] || 'Usuario'}`

    // Crear familia usando función SQL (bypass RLS)
    const { data: familyResult, error: familyError } = await supabase.rpc('create_family_for_user', {
      p_user_id: authUser.id,
      p_family_name: familyName,
    })

    if (!familyError && familyResult && familyResult.length > 0) {
      const result = familyResult[0] as { family_id: number; family_name: string; success: boolean; message: string }
      if (result.success) {
        const addressPayload = {
          address_line1: typeof address_line1 === 'string' && address_line1.trim() ? address_line1.trim() : null,
          address_line2: typeof address_line2 === 'string' && address_line2.trim() ? address_line2.trim() : null,
          city: typeof city === 'string' && city.trim() ? city.trim() : null,
          state: typeof state === 'string' && state.trim() ? state.trim() : null,
          postal_code: typeof postal_code === 'string' && postal_code.trim() ? postal_code.trim() : null,
          country: typeof country === 'string' && country.trim() ? country.trim() : null,
        }
        const hasAddress = Object.values(addressPayload).some((value) => value)
        if (hasAddress) {
          const { error: updateError } = await supabase
            .from('families')
            .update({ ...addressPayload, updated_at: new Date().toISOString() })
            .eq('id', result.family_id)
          if (updateError) {
            console.error('Error actualizando dirección de familia:', updateError)
          }
        }
        return NextResponse.json(
          {
            family_id: result.family_id,
            family_name: result.family_name || familyName,
            message: result.message || 'Familia creada exitosamente',
          },
          { status: 201 }
        )
      }
      return NextResponse.json(
        { detail: result.message || 'Error al crear familia' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        detail: familyError?.message || 'Error al crear familia. Ejecuta el SQL en supabase/funcion-crear-familia-auto.sql',
      },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('Error al crear familia:', error)
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    )
  }
}
