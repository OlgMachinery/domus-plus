import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const familyId = parseInt(id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario pertenezca a esta familia
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (userData?.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    const { data: family, error } = await supabase
      .from('families')
      .select(`
        *,
        members:users!users_family_id_fkey(*)
      `)
      .eq('id', familyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Familia no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener familia: ${error.message}` },
        { status: 500 }
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const familyId = parseInt(id)
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

    if (!name) {
      return NextResponse.json(
        { detail: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id || userData.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    if (!userData.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede editar la familia' },
        { status: 403 }
      )
    }

    const { data: updated, error } = await supabase
      .from('families')
      .update({ name, ...addressPayload, updated_at: new Date().toISOString() })
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const familyId = parseInt(id)

    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id || userData.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    if (!userData.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede eliminar la familia' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('families')
      .delete()
      .eq('id', familyId)

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
