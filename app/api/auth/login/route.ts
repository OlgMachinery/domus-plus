import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const maxDuration = 25

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { detail: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      return NextResponse.json(
        { detail: 'Configuración de Supabase faltante en el servidor' },
        { status: 500 }
      )
    }

    const pendingCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookies.forEach((cookie) => pendingCookies.push(cookie))
        },
      },
    })

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { detail: authError.message || 'Email o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { detail: 'No se pudo autenticar el usuario' },
        { status: 500 }
      )
    }

    const accessToken = authData.session?.access_token
    const supabaseAuthed = accessToken
      ? createServerClient(url, key, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll() {
              // No-op: usamos el access token para RLS en este flujo
            },
          },
        })
      : supabase

    let { data: userData, error: userError } = await supabaseAuthed
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (userError || !userData) {
      // Intentar crear el usuario si no existe
      const { data: sqlResult, error: sqlError } = await supabaseAuthed.rpc('ensure_user_exists', {
        p_user_id: authData.user.id,
        p_email: authData.user.email || '',
        p_name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Usuario',
        p_phone: authData.user.user_metadata?.phone || null,
      })

      if (!sqlError && sqlResult && sqlResult.length > 0) {
        const ensured = sqlResult[0] as { id: string; email: string; name: string; is_active: boolean }
        userData = {
          id: ensured.id,
          email: ensured.email,
          name: ensured.name,
          is_active: ensured.is_active,
          is_family_admin: false,
          family_id: null,
        }
      } else {
        // Fallback: insertar directamente
        const { data: newUser, error: createError } = await supabaseAuthed
          .from('users')
          .insert({
            id: authData.user.id,
            email: authData.user.email || '',
            name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Usuario',
            phone: authData.user.user_metadata?.phone || null,
            is_active: true,
            is_family_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (createError || !newUser) {
          return NextResponse.json(
            { detail: 'Usuario no encontrado y no se pudo crear' },
            { status: 500 }
          )
        }

        userData = newUser
      }
    }

    if (!userData.is_active) {
      return NextResponse.json(
        { detail: 'Usuario inactivo. Contacta al administrador.' },
        { status: 403 }
      )
    }

    const response = NextResponse.json(
      { user: userData, access_token: authData.session?.access_token },
      { status: 200 }
    )
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options ?? {})
    })
    return response
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error al procesar el login'
    console.error('Error en login:', error)
    return NextResponse.json(
      { detail: msg },
      { status: 500 }
    )
  }
}
