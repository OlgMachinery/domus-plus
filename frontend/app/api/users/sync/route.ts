import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Esta API route crea automáticamente el usuario en la tabla users si no existe
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }
    
    // Verificar si el usuario existe en la tabla users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single()
    
    if (existingUser) {
      return NextResponse.json(
        { 
          detail: 'Usuario ya existe en la base de datos',
          user: existingUser
        },
        { status: 200 }
      )
    }
    
    // Intentar usar la función SQL con SECURITY DEFINER primero
    const { data: sqlResult, error: sqlError } = await supabase.rpc('ensure_user_exists', {
      p_user_id: authUser.id,
      p_email: authUser.email || '',
      p_name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
      p_phone: authUser.user_metadata?.phone || null
    })
    
    if (sqlError || !sqlResult || sqlResult.length === 0) {
      console.warn('⚠️ Función SQL falló, intentando insert directo:', sqlError)
      
      // Fallback: insertar directamente
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
          phone: authUser.user_metadata?.phone || null,
          is_active: true,
          is_family_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (createError) {
        console.error('Error creando usuario:', createError)
        return NextResponse.json(
          { 
            detail: 'Error al crear usuario en la base de datos',
            error: createError.message,
            errorCode: createError.code,
            hint: 'Ejecuta el SQL en supabase/crear-usuario-automatico.sql para crear la función ensure_user_exists'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { 
          detail: 'Usuario creado exitosamente',
          user: newUser
        },
        { status: 201 }
      )
    }
    
    // Obtener el usuario creado por la función SQL
    const { data: newUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()
    
    if (!newUser) {
      return NextResponse.json(
        { 
          detail: 'Usuario creado pero no se pudo recuperar',
          error: 'Error al obtener usuario después de creación'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        detail: 'Usuario creado exitosamente',
        user: newUser
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error en sync user:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
