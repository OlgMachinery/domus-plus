import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const categoryId = parseInt(id)
    const body = await request.json()

    // Verificar autenticación
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
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Verificar que la categoría pertenezca a la familia del usuario
    const { data: category } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('family_id', userData.family_id)
      .single()

    if (!category) {
      return NextResponse.json(
        { detail: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Validaciones
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { detail: 'El nombre de la subcategoría es requerido' },
        { status: 400 }
      )
    }

    // Verificar que no exista una subcategoría con el mismo nombre
    const { data: existing } = await supabase
      .from('custom_subcategories')
      .select('id')
      .eq('custom_category_id', categoryId)
      .eq('name', body.name.trim())
      .single()

    if (existing) {
      return NextResponse.json(
        { detail: `Ya existe una subcategoría con el nombre '${body.name}'` },
        { status: 400 }
      )
    }

    // Crear subcategoría
    const { data: subcategory, error: subError } = await supabase
      .from('custom_subcategories')
      .insert({
        custom_category_id: categoryId,
        name: body.name.trim(),
        description: body.description || null,
        is_active: true,
      })
      .select()
      .single()

    if (subError) {
      console.error('Error creando subcategoría:', subError)
      return NextResponse.json(
        { detail: `Error al crear subcategoría: ${subError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(subcategory, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/custom-categories/[id]/subcategories:', error)
    return NextResponse.json(
      { detail: `Error al crear subcategoría: ${error.message}` },
      { status: 500 }
    )
  }
}
