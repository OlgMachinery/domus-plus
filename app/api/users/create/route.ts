import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const getAuthUser = async (supabase: Awaited<ReturnType<typeof createClient>>, request: NextRequest) => {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null
  if (token) {
    const result = await supabase.auth.getUser(token)
    if (!result.error && result.data.user) return result
  }
  return supabase.auth.getUser()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, phone, name, family_id } = body

    // Validaciones básicas
    if (!email || !password || !phone || !name) {
      return NextResponse.json(
        { detail: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { detail: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar que el usuario actual sea administrador
    const { data: { user: authUser } } = await getAuthUser(supabase, request)
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('is_family_admin, family_id')
      .eq('id', authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json(
        { detail: 'Error al verificar usuario' },
        { status: 500 }
      )
    }

    if (!currentUser.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo los administradores pueden crear usuarios' },
        { status: 403 }
      )
    }

    // Usar el family_id del administrador si no se proporciona
    const targetFamilyId = family_id || currentUser.family_id

    if (!targetFamilyId) {
      return NextResponse.json(
        { detail: 'El administrador no tiene familia asignada' },
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

    const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim(),
        phone: phone.trim(),
      },
    })

    if (createAuthError || !createdAuth?.user) {
      const msg = createAuthError?.message || 'No se pudo crear el usuario en auth'
      const isDuplicate = /already registered|exists/i.test(msg)
      return NextResponse.json(
        { detail: isDuplicate ? 'El email ya está registrado' : `Error al crear usuario: ${msg}` },
        { status: isDuplicate ? 400 : 500 }
      )
    }

    const { data: newUser, error: dbError } = await admin
      .from('users')
      .insert({
        id: createdAuth.user.id,
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim(),
        is_active: true,
        is_family_admin: false,
        family_id: targetFamilyId,
      })
      .select()
      .single()

    if (dbError || !newUser) {
      console.error('Error al crear usuario en public.users:', dbError)
      return NextResponse.json(
        { detail: `Error al crear usuario: ${dbError?.message || 'No se pudo crear el perfil'}` },
        { status: 500 }
      )
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    console.error('Error en creación de usuario:', error)
    return NextResponse.json(
      { detail: `Error al crear usuario: ${error.message}` },
      { status: 500 }
    )
  }
}
