import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const maxDuration = 25

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      return NextResponse.json(
        { detail: 'Configuración de Supabase faltante. Revisa las variables de entorno en Vercel.' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { email, password, phone, name } = body || {}

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

    // Intentar crear registro en tabla users
    // Primero intentamos INSERT directo (más simple y confiable)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email.trim(),
        phone: phone.trim(),
        name: name.trim(),
        is_active: true,
        is_family_admin: false,
      })
      .select()
      .single()

    if (userError) {
      console.error('Error al crear perfil de usuario:', userError)
      console.error('Usuario de auth creado pero perfil falló:', authData.user.id)
      
      // Mensaje más específico según el tipo de error
      let errorMessage = userError.message || 'Error desconocido'
      let errorDetail = ''
      
      if (errorMessage.includes('row-level security') || errorMessage.includes('RLS') || errorMessage.includes('policy')) {
        errorDetail = 'Error de permisos (RLS): Las políticas de seguridad están bloqueando el registro. Ejecuta el SQL de "supabase/verificar-y-fix-rls-registro.sql" en Supabase SQL Editor.'
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique') || errorMessage.includes('already exists')) {
        errorDetail = 'El usuario ya existe en la base de datos.'
      } else if (errorMessage.includes('Database error')) {
        errorDetail = 'Error de base de datos. Verifica que las políticas RLS estén configuradas correctamente ejecutando "supabase/verificar-y-fix-rls-registro.sql" en Supabase.'
      } else {
        errorDetail = `Error técnico: ${errorMessage}`
      }
      
      return NextResponse.json(
        { 
          detail: `Error al crear perfil: ${errorDetail}. El usuario fue creado en auth.users pero no en public.users.`,
          error_code: userError.code,
          error_message: userError.message
        },
        { status: 500 }
      )
    }

    // Usuario creado exitosamente
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
