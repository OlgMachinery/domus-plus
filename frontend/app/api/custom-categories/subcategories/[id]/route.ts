import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const subcategoryId = parseInt(params.id)
    const updates = await request.json()

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

    // Verificar que la subcategoría exista y pertenezca a la familia
    const { data: subcategory } = await supabase
      .from('custom_subcategories')
      .select(`
        *,
        custom_category:custom_categories(*)
      `)
      .eq('id', subcategoryId)
      .single()

    if (!subcategory) {
      return NextResponse.json(
        { detail: 'Subcategoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la categoría pertenezca a la familia
    if (subcategory.custom_category?.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta subcategoría' },
        { status: 403 }
      )
    }

    // Verificar nombre único si se está cambiando
    if (updates.name && updates.name !== subcategory.name) {
      const { data: existing } = await supabase
        .from('custom_subcategories')
        .select('id')
        .eq('custom_category_id', subcategory.custom_category_id)
        .eq('name', updates.name)
        .neq('id', subcategoryId)
        .single()

      if (existing) {
        return NextResponse.json(
          { detail: `Ya existe una subcategoría con el nombre '${updates.name}'` },
          { status: 400 }
        )
      }
    }

    // Preparar actualizaciones
    const updateData: any = {}
    if (updates.name) updateData.name = updates.name.trim()
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active

    const { data: updatedSubcategory, error: updateError } = await supabase
      .from('custom_subcategories')
      .update(updateData)
      .eq('id', subcategoryId)
      .select()
      .single()

    if (updateError) {
      console.error('Error actualizando subcategoría:', updateError)
      return NextResponse.json(
        { detail: `Error al actualizar subcategoría: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedSubcategory, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/custom-categories/subcategories/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar subcategoría: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const subcategoryId = parseInt(params.id)

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

    // Verificar que la subcategoría exista y pertenezca a la familia
    const { data: subcategory } = await supabase
      .from('custom_subcategories')
      .select(`
        *,
        custom_category:custom_categories(*)
      `)
      .eq('id', subcategoryId)
      .single()

    if (!subcategory) {
      return NextResponse.json(
        { detail: 'Subcategoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que la categoría pertenezca a la familia
    if (subcategory.custom_category?.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta subcategoría' },
        { status: 403 }
      )
    }

    // Verificar si hay transacciones usando esta subcategoría
    const { count: transactionsCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('custom_subcategory_id', subcategoryId)

    if ((transactionsCount || 0) > 0) {
      // Solo desactivar
      await supabase
        .from('custom_subcategories')
        .update({ is_active: false })
        .eq('id', subcategoryId)

      return NextResponse.json(
        { message: 'Subcategoría desactivada (tiene transacciones asociadas)' },
        { status: 200 }
      )
    } else {
      // Eliminar completamente
      await supabase
        .from('custom_subcategories')
        .delete()
        .eq('id', subcategoryId)

      return NextResponse.json(
        { message: 'Subcategoría eliminada exitosamente' },
        { status: 200 }
      )
    }
  } catch (error: any) {
    console.error('Error en DELETE /api/custom-categories/subcategories/[id]:', error)
    return NextResponse.json(
      { detail: `Error al eliminar subcategoría: ${error.message}` },
      { status: 500 }
    )
  }
}
