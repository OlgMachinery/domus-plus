import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const budgetId = parseInt(params.id)
    const updates = await request.json()

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
        { detail: 'Solo los administradores pueden actualizar presupuestos' },
        { status: 403 }
      )
    }

    // Verificar que el presupuesto exista y pertenezca a la familia
    const { data: currentBudget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', budgetId)
      .single()

    if (!currentBudget) {
      return NextResponse.json(
        { detail: 'Presupuesto no encontrado' },
        { status: 404 }
      )
    }

    if (currentBudget.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este presupuesto' },
        { status: 403 }
      )
    }

    // Validaciones
    if (updates.total_amount !== undefined) {
      if (updates.total_amount <= 0) {
        return NextResponse.json(
          { detail: 'El monto debe ser mayor a cero' },
          { status: 400 }
        )
      }
      if (updates.total_amount > 1000000000) {
        return NextResponse.json(
          { detail: 'El monto excede el límite permitido' },
          { status: 400 }
        )
      }
    }

    if (updates.year !== undefined) {
      const currentYear = new Date().getFullYear()
      if (updates.year < currentYear - 1 || updates.year > currentYear + 1) {
        return NextResponse.json(
          { detail: 'El año debe ser el actual, anterior o siguiente' },
          { status: 400 }
        )
      }
    }

    // Preparar actualizaciones
    const updateData: any = {}
    if (updates.category !== undefined) updateData.category = updates.category
    if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory
    if (updates.year !== undefined) updateData.year = updates.year
    if (updates.total_amount !== undefined) updateData.total_amount = updates.total_amount
    if (updates.monthly_amounts !== undefined) updateData.monthly_amounts = updates.monthly_amounts
    if (updates.budget_type !== undefined) updateData.budget_type = updates.budget_type
    if (updates.distribution_method !== undefined) updateData.distribution_method = updates.distribution_method
    if (updates.auto_distribute !== undefined) updateData.auto_distribute = updates.auto_distribute
    if (updates.target_user_id !== undefined) updateData.target_user_id = updates.target_user_id
    if (updates.custom_category_id !== undefined) updateData.custom_category_id = updates.custom_category_id
    if (updates.custom_subcategory_id !== undefined) updateData.custom_subcategory_id = updates.custom_subcategory_id

    const { data: updatedBudget, error: updateError } = await supabase
      .from('family_budgets')
      .update(updateData)
      .eq('id', budgetId)
      .select()
      .single()

    if (updateError) {
      console.error('Error actualizando presupuesto:', updateError)
      return NextResponse.json(
        { detail: `Error al actualizar presupuesto: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budget_updated',
        entity_type: 'budget',
        description: `Presupuesto actualizado: ${updatedBudget.category} - ${updatedBudget.subcategory}`,
        entity_id: updatedBudget.id,
        details: updates,
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json(updatedBudget, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/budgets/family/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
