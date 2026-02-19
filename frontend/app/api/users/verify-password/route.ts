import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    if (!body.password) {
      return NextResponse.json(
        { detail: 'Contraseña requerida' },
        { status: 400 }
      )
    }

    // Verificar contraseña usando Supabase Auth
    // Intentar hacer sign in con el email y la contraseña
    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', authUser.id)
      .single()

    if (!userData?.email) {
      return NextResponse.json(
        { detail: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar contraseña intentando hacer sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: body.password,
    })

    if (signInError) {
      return NextResponse.json(
        { detail: 'Contraseña incorrecta', valid: false },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { detail: 'Contraseña correcta', valid: true },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error en POST /api/users/verify-password:', error)
    return NextResponse.json(
      { detail: `Error al verificar contraseña: ${error.message}` },
      { status: 500 }
    )
  }
}
