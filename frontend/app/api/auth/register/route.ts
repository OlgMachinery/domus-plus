import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, phone, name } = body

    // Validaciones
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

    if (phone.length < 10) {
      return NextResponse.json(
        { detail: 'Teléfono inválido' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
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

    // Crear registro en tabla users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        phone: phone.trim(),
        name: name.trim(),
        is_active: true,
        is_family_admin: false,
      })
      .select()
      .single()

    if (userError) {
      // Si falla, intentar eliminar el usuario de auth
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { detail: `Error al crear perfil: ${userError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(userData, { status: 201 })
  } catch (error: any) {
    console.error('Error en registro:', error)
    return NextResponse.json(
      { detail: `Error al registrar usuario: ${error.message}` },
      { status: 500 }
    )
  }
}
