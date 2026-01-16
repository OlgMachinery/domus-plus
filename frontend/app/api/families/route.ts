import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json([])
    }

    // Obtener familia con miembros
    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .select(`
        *,
        members:users(*)
      `)
      .eq('id', userData.family_id)
      .single()

    if (familyError) {
      return NextResponse.json(
        { detail: familyError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(familyData)
  } catch (error: any) {
    console.error('Error al obtener familia:', error)
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { detail: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    const supabase = await createClient(request)
    
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Crear familia
    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .insert({
        name,
        admin_id: authUser.id,
      })
      .select()
      .single()

    if (familyError) {
      return NextResponse.json(
        { detail: familyError.message },
        { status: 500 }
      )
    }

    // Actualizar usuario para asignarlo a la familia
    await supabase
      .from('users')
      .update({ family_id: familyData.id })
      .eq('id', authUser.id)

    return NextResponse.json(familyData, { status: 201 })
  } catch (error: any) {
    console.error('Error al crear familia:', error)
    return NextResponse.json(
      { detail: error.message },
      { status: 500 }
    )
  }
}
