import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; user_id: string } }
) {
  try {
    const supabase = await createClient()
    const familyId = parseInt(params.id)
    const userId = params.user_id

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener usuario actual
    const { data: currentUserData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    // Verificar que el usuario actual sea admin
    if (!currentUserData?.is_family_admin || currentUserData.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede agregar miembros' },
        { status: 403 }
      )
    }

    // Verificar que la familia exista
    const { data: family } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single()

    if (!family) {
      return NextResponse.json(
        { detail: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que el usuario a agregar exista
    const { data: userToAdd } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!userToAdd) {
      return NextResponse.json(
        { detail: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el usuario no pertenezca ya a otra familia
    if (userToAdd.family_id && userToAdd.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'El usuario ya pertenece a otra familia' },
        { status: 400 }
      )
    }

    if (userToAdd.family_id === familyId) {
      return NextResponse.json(
        { detail: 'El usuario ya pertenece a esta familia' },
        { status: 400 }
      )
    }

    // Agregar usuario a la familia
    const { error: updateError } = await supabase
      .from('users')
      .update({ family_id: familyId })
      .eq('id', userId)

    if (updateError) {
      console.error('Error agregando miembro:', updateError)
      return NextResponse.json(
        { detail: `Error al agregar miembro: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Miembro agregado exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error en POST /api/families/[id]/members/[user_id]:', error)
    return NextResponse.json(
      { detail: `Error al agregar miembro: ${error.message}` },
      { status: 500 }
    )
  }
}
