import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const familyId = parseInt(params.id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario pertenezca a esta familia
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (userData?.family_id !== familyId) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta familia' },
        { status: 403 }
      )
    }

    const { data: members, error } = await supabase
      .from('users')
      .select('*')
      .eq('family_id', familyId)
      .order('name')

    if (error) {
      console.error('Error obteniendo miembros:', error)
      return NextResponse.json(
        { detail: `Error al obtener miembros: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(members || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/families/[id]/members:', error)
    return NextResponse.json(
      { detail: `Error al obtener miembros: ${error.message}` },
      { status: 500 }
    )
  }
}
