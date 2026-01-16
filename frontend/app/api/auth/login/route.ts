import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const supabase = await createClient()

    // Autenticar con Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { detail: 'Email o contraseña incorrectos' },
        { status: 401 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { detail: 'No se pudo autenticar el usuario' },
        { status: 500 }
      )
    }

    // Verificar que el usuario esté activo en la tabla users
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
        { detail: 'Usuario inactivo. Contacta al administrador.' },
        { status: 403 }
      )
    }

    // Obtener la sesión para devolver el token
    const { data: sessionData } = await supabase.auth.getSession()

    return NextResponse.json({
      access_token: sessionData?.session?.access_token,
      token_type: 'bearer',
      user: userData,
    })
  } catch (error: any) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { detail: `Error al procesar el login: ${error.message}` },
      { status: 500 }
    )
  }
}
