import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const accountId = parseInt(params.id)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener usuario completo
    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!userData?.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo los administradores pueden modificar nombres de cuentas' },
        { status: 403 }
      )
    }

    // Verificar que la cuenta exista y pertenezca a la familia
    const { data: budget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', accountId)
      .single()

    if (!budget) {
      return NextResponse.json(
        { detail: 'Cuenta no encontrada' },
        { status: 404 }
      )
    }

    if (budget.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta cuenta' },
        { status: 403 }
      )
    }

    // Obtener display_names actuales
    let currentDisplayNames = budget.display_names
    if (typeof currentDisplayNames === 'string') {
      try {
        currentDisplayNames = JSON.parse(currentDisplayNames)
      } catch {
        currentDisplayNames = {}
      }
    }
    if (!currentDisplayNames) {
      currentDisplayNames = {}
    }

    // Actualizar display_names
    if (body.category_display_name !== undefined) {
      if (body.category_display_name) {
        currentDisplayNames.category = body.category_display_name
      } else {
        delete currentDisplayNames.category
      }
    }

    if (body.subcategory_display_name !== undefined) {
      if (body.subcategory_display_name) {
        currentDisplayNames.subcategory = body.subcategory_display_name
      } else {
        delete currentDisplayNames.subcategory
      }
    }

    // Actualizar en la base de datos
    const updateData: any = {}
    if (Object.keys(currentDisplayNames).length > 0) {
      updateData.display_names = currentDisplayNames
    } else {
      updateData.display_names = null
    }

    const { data: updatedBudget, error: updateError } = await supabase
      .from('family_budgets')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) {
      console.error('Error actualizando nombres:', updateError)
      return NextResponse.json(
        { detail: `Error al actualizar nombres: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'account_display_name_updated',
        entity_type: 'budget',
        description: `Nombres de visualización actualizados: ${updatedBudget.category} - ${updatedBudget.subcategory}`,
        entity_id: updatedBudget.id,
        details: {
          category: updatedBudget.category,
          subcategory: updatedBudget.subcategory,
          category_display_name: body.category_display_name,
          subcategory_display_name: body.subcategory_display_name,
        },
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json({
      id: updatedBudget.id,
      category: updatedBudget.category,
      subcategory: updatedBudget.subcategory,
      category_display_name: currentDisplayNames.category || null,
      subcategory_display_name: currentDisplayNames.subcategory || null,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/budgets/account/[id]/display-names:', error)
    return NextResponse.json(
      { detail: `Error al actualizar nombres: ${error.message}` },
      { status: 500 }
    )
  }
}
