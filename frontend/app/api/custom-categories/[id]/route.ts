import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const categoryId = parseInt(params.id)

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

    const { data: category, error } = await supabase
      .from('custom_categories')
      .select(`
        *,
        subcategories:custom_subcategories(*)
      `)
      .eq('id', categoryId)
      .eq('family_id', userData.family_id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Categoría no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener categoría: ${error.message}` },
        { status: 500 }
      )
    }

    // Filtrar subcategorías activas
    if (category.subcategories) {
      category.subcategories = category.subcategories.filter((sub: any) => sub.is_active)
    }

    return NextResponse.json(category, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/custom-categories/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener categoría: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const categoryId = parseInt(params.id)
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

    // Verificar que la categoría exista y pertenezca a la familia
    const { data: currentCategory } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('id', categoryId)
      .eq('family_id', userData.family_id)
      .single()

    if (!currentCategory) {
      return NextResponse.json(
        { detail: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar nombre único si se está cambiando
    if (updates.name && updates.name !== currentCategory.name) {
      const { data: existing } = await supabase
        .from('custom_categories')
        .select('id')
        .eq('family_id', userData.family_id)
        .eq('name', updates.name)
        .neq('id', categoryId)
        .single()

      if (existing) {
        return NextResponse.json(
          { detail: `Ya existe una categoría con el nombre '${updates.name}'` },
          { status: 400 }
        )
      }
    }

    const updateData: any = {}
    if (updates.name) updateData.name = updates.name.trim()
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.icon !== undefined) updateData.icon = updates.icon
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active

    const { data: updatedCategory, error: updateError } = await supabase
      .from('custom_categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single()

    if (updateError) {
      console.error('Error actualizando categoría:', updateError)
      return NextResponse.json(
        { detail: `Error al actualizar categoría: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Sincronizar subcategorías si se envía el array
    if (Array.isArray(updates.subcategories)) {
      const { data: existingSubs } = await supabase
        .from('custom_subcategories')
        .select('id, name')
        .eq('custom_category_id', categoryId)
      const existingById = new Map((existingSubs || []).map((s: any) => [s.id, s]))
      const namesSent = new Set(updates.subcategories.map((s: any) => (s.name || '').trim()).filter(Boolean))
      const toKeep: number[] = []
      for (const sub of updates.subcategories) {
        const name = (sub.name || '').trim()
        if (!name) continue
        if (sub.id && existingById.has(sub.id)) {
          await supabase
            .from('custom_subcategories')
            .update({ name, description: sub.description ?? null })
            .eq('id', sub.id)
          toKeep.push(sub.id)
        } else {
          const { data: created } = await supabase
            .from('custom_subcategories')
            .insert({ custom_category_id: categoryId, name, description: sub.description ?? null, is_active: true })
            .select('id')
            .single()
          if (created?.id) toKeep.push(created.id)
        }
      }
      for (const existing of Array.from(existingById.values())) {
        if (!toKeep.includes(existing.id)) {
          await supabase
            .from('custom_subcategories')
            .update({ is_active: false })
            .eq('id', existing.id)
        }
      }
    }

    const { data: subcategories } = await supabase
      .from('custom_subcategories')
      .select('*')
      .eq('custom_category_id', categoryId)
      .eq('is_active', true)
      .order('name')

    return NextResponse.json({
      ...updatedCategory,
      subcategories: subcategories || [],
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/custom-categories/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar categoría: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const categoryId = parseInt(params.id)

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

    // Verificar que la categoría exista y pertenezca a la familia
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

    // Verificar si hay presupuestos o transacciones usando esta categoría
    const { count: budgetsCount } = await supabase
      .from('family_budgets')
      .select('*', { count: 'exact', head: true })
      .eq('custom_category_id', categoryId)

    const { count: transactionsCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('custom_category_id', categoryId)

    if ((budgetsCount || 0) > 0 || (transactionsCount || 0) > 0) {
      // Solo desactivar
      await supabase
        .from('custom_categories')
        .update({ is_active: false })
        .eq('id', categoryId)

      // Desactivar subcategorías también
      await supabase
        .from('custom_subcategories')
        .update({ is_active: false })
        .eq('custom_category_id', categoryId)

      return NextResponse.json(
        { message: 'Categoría desactivada (tiene presupuestos o transacciones asociadas)' },
        { status: 200 }
      )
    } else {
      // Eliminar completamente
      await supabase
        .from('custom_categories')
        .delete()
        .eq('id', categoryId)

      return NextResponse.json(
        { message: 'Categoría eliminada exitosamente' },
        { status: 200 }
      )
    }
  } catch (error: any) {
    console.error('Error en DELETE /api/custom-categories/[id]:', error)
    return NextResponse.json(
      { detail: `Error al eliminar categoría: ${error.message}` },
      { status: 500 }
    )
  }
}
