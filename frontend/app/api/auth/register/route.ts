import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const maxDuration = 25

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    if (!url || !key) {
      return NextResponse.json(
        { detail: 'Configuración de Supabase faltante. Revisa las variables de entorno en Vercel.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { email, password, phone, name, city, belongs_to_family } = body || {}

    if (!email || !password || !phone || !name || !(city != null && String(city).trim())) {
      return NextResponse.json(
        { detail: 'Faltan campos requeridos (email, contraseña, teléfono, nombre, ciudad)' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { detail: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    if (phone.length < 10) {
      return NextResponse.json(
        { detail: 'Teléfono inválido' },
        { status: 400 }
      )
    }

    const res = NextResponse.next({ request })
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options ?? {})
          )
        },
      },
    })

    // Crear usuario en Supabase Auth (solo anon key; por defecto el email NO queda confirmado)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: undefined },
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json(
          { detail: 'Email ya registrado' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { detail: `Error al crear usuario: ${authError.message}` },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { detail: 'No se pudo crear el usuario' },
        { status: 500 }
      )
    }

    // Auto-confirmar email para que el usuario pueda hacer login sin pasar por el panel de Supabase
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      const admin = createAdminClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      await admin.auth.admin.updateUserById(authData.user.id, { email_confirm: true })
    }

    const userRow = {
      id: authData.user.id,
      email: email.trim(),
      phone: phone.trim(),
      name: name.trim(),
      city: typeof city === 'string' ? city.trim() || null : null,
      belongs_to_family: Boolean(belongs_to_family),
      is_active: true,
      is_family_admin: false,
    }

    // Crear registro en public.users: con anon key la sesión ya está establecida, RLS "insert own" permite el insert
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert(userRow)
      .select()
      .single()

    if (userError) {
      console.error('Error al crear perfil de usuario:', userError)
      console.error('Usuario de auth creado pero perfil falló:', authData.user.id)

      // Si tenemos service role, intentar insertar desde el servidor (bypasea RLS)
      if (serviceRoleKey) {
        const admin = createAdminClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data: inserted, error: adminInsertError } = await admin
          .from('users')
          .insert(userRow)
          .select()
          .single()
        if (!adminInsertError && inserted) {
          res.headers.set('content-type', 'application/json')
          return NextResponse.json(inserted, { status: 201 })
        }
      }

      let errorMessage = userError.message || 'Error desconocido'
      let errorDetail = ''
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS') || errorMessage.includes('policy')) {
        errorDetail = 'Error de permisos (RLS). Añade SUPABASE_SERVICE_ROLE_KEY en el servidor para que el registro cree también la fila en public.users.'
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('already exists')) {
        errorDetail = 'El usuario ya existe en la base de datos.'
      } else {
        errorDetail = `Error técnico: ${errorMessage}`
      }
      return NextResponse.json(
        {
          detail: `Error al crear perfil: ${errorDetail}. El usuario fue creado en auth.users pero no en public.users.`,
          error_code: userError.code,
          error_message: userError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(userData, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Error en registro:', error)
    return NextResponse.json(
      { detail: `Error al registrar: ${msg}. Si ves "fetch failed" en el navegador, abre en otra pestaña: /api/health para comprobar si el servidor responde.` },
      { status: 500 }
    )
  }
}
