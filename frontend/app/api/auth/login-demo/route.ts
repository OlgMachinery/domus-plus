import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const demoEmail = process.env.DEMO_EMAIL
    const demoPassword = process.env.DEMO_PASSWORD
    if (!demoEmail || !demoPassword) {
      return NextResponse.json(
        { detail: 'Usuario demo no configurado. Añade DEMO_EMAIL y DEMO_PASSWORD en las variables de entorno.' },
        { status: 503 }
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

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    })

    if (authError) {
      return NextResponse.json(
        { detail: authError.message || 'Usuario demo no disponible' },
        { status: 401 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { detail: 'No se pudo autenticar' },
        { status: 500 }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { detail: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (!userData.is_active) {
      return NextResponse.json(
        { detail: 'Usuario inactivo' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { user: userData },
      { status: 200, headers: res.headers }
    )
  } catch (error: any) {
    console.error('Error en login demo:', error)
    return NextResponse.json(
      { detail: error?.message || 'Error al procesar el login demo' },
      { status: 500 }
    )
  }
}
