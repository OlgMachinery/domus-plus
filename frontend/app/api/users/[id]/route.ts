import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const getAuthUser = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: NextRequest
) => {
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
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const userId = params.id

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener usuario actual para verificar familia
    const { data: currentUserData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    // Obtener usuario solicitado
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Usuario no encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener usuario: ${error.message}` },
        { status: 500 }
      )
    }

    // Verificar que el usuario pertenezca a la misma familia
    // O que sea el mismo usuario
    if (user.id !== authUser.id && user.family_id !== currentUserData?.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este usuario' },
        { status: 403 }
      )
    }

    return NextResponse.json(user, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/users/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener usuario: ${error.message}` },
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
    const userId = params.id
    const body = await request.json().catch(() => ({}))

    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: currentUserData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!currentUserData?.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede editar integrantes' },
        { status: 403 }
      )
    }

    const { data: targetUser } = await supabase
      .from('users')
      .select('id, family_id')
      .eq('id', userId)
      .single()

    if (!targetUser || targetUser.family_id !== currentUserData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este usuario' },
        { status: 403 }
      )
    }

    const updates: Record<string, any> = {}
    if (typeof body?.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json(
          { detail: 'El nombre es requerido' },
          { status: 400 }
        )
      }
      updates.name = name
    }
    if (typeof body?.phone === 'string') {
      updates.phone = body.phone.trim() ? body.phone.trim() : null
    }
    if (typeof body?.is_active === 'boolean') {
      updates.is_active = body.is_active
    }
    if (typeof body?.is_family_admin === 'boolean') {
      updates.is_family_admin = body.is_family_admin
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { detail: 'No hay cambios para actualizar' },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single()

    if (error || !updated) {
      return NextResponse.json(
        { detail: `Error al actualizar usuario: ${error?.message || 'Desconocido'}` },
        { status: 500 }
      )
    }

    return NextResponse.json(updated, { status: 200 })
  } catch (error: any) {
    console.error('Error en PATCH /api/users/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar usuario: ${error.message}` },
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
    const userId = params.id

    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    if (authUser.id === userId) {
      return NextResponse.json(
        { detail: 'No puedes eliminar tu propio usuario' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { detail: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor' },
        { status: 500 }
      )
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: currentUserData } = await admin
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!currentUserData?.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede eliminar integrantes' },
        { status: 403 }
      )
    }

    const { data: targetUser } = await admin
      .from('users')
      .select('id, family_id, is_family_admin')
      .eq('id', userId)
      .single()

    if (!targetUser || targetUser.family_id !== currentUserData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este usuario' },
        { status: 403 }
      )
    }

    if (targetUser.is_family_admin) {
      const { data: adminUsers, error: adminError } = await admin
        .from('users')
        .select('id')
        .eq('family_id', currentUserData.family_id)
        .eq('is_family_admin', true)

      if (adminError) {
        return NextResponse.json(
          { detail: `Error al validar administradores: ${adminError.message}` },
          { status: 500 }
        )
      }

      if ((adminUsers?.length || 0) <= 1) {
        return NextResponse.json(
          { detail: 'Debe existir al menos un administrador en la familia' },
          { status: 400 }
        )
      }
    }

    const { data: updated, error } = await admin
      .from('users')
      .update({
        family_id: null,
        is_family_admin: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('*')
      .single()

    if (error || !updated) {
      return NextResponse.json(
        { detail: `Error al eliminar integrante: ${error?.message || 'Desconocido'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error: any) {
    console.error('Error en DELETE /api/users/[id]:', error)
    return NextResponse.json(
      { detail: `Error al eliminar integrante: ${error.message}` },
      { status: 500 }
    )
  }
}
