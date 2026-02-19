import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const budgetId = parseInt(params.id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: budget, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name, email)
        )
      `)
      .eq('id', budgetId)
      .eq('budget_type', 'individual')
      .eq('target_user_id', authUser.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Presupuesto no encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener presupuesto: ${error.message}` },
        { status: 500 }
      )
    }

    // Calcular income_amount y available_amount
    if (budget.user_allocations) {
      for (const allocation of budget.user_allocations) {
        const { data: incomeTransactions } = await supabase
          .from('transactions')
          .select('amount')
          .eq('family_budget_id', budgetId)
          .eq('user_id', allocation.user_id)
          .eq('transaction_type', 'income')

        const incomeAmount = incomeTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0
        allocation.income_amount = incomeAmount
        allocation.available_amount = 
          (allocation.allocated_amount || 0) + 
          incomeAmount - 
          (allocation.spent_amount || 0)
      }
    }

    return NextResponse.json(budget, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/personal-budgets/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener presupuesto: ${error.message}` },
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

    // Verificar que el presupuesto exista y pertenezca al usuario
    const { data: currentBudget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', budgetId)
      .eq('budget_type', 'individual')
      .eq('target_user_id', authUser.id)
      .single()

    if (!currentBudget) {
      return NextResponse.json(
        { detail: 'Presupuesto no encontrado' },
        { status: 404 }
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
    if (updates.due_date !== undefined) updateData.due_date = updates.due_date
    if (updates.payment_status !== undefined) updateData.payment_status = updates.payment_status
    if (updates.notes !== undefined) updateData.notes = updates.notes
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

    // Actualizar user_budget si cambió el total_amount
    if (updates.total_amount !== undefined) {
      await supabase
        .from('user_budgets')
        .update({ allocated_amount: updates.total_amount })
        .eq('family_budget_id', budgetId)
        .eq('user_id', authUser.id)
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budget_updated',
        entity_type: 'budget',
        description: `Presupuesto personal actualizado: ${updatedBudget.category} - ${updatedBudget.subcategory}`,
        entity_id: updatedBudget.id,
        details: updates,
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json(updatedBudget, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/personal-budgets/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar presupuesto: ${error.message}` },
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
    const budgetId = parseInt(params.id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que el presupuesto exista y pertenezca al usuario
    const { data: budget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', budgetId)
      .eq('budget_type', 'individual')
      .eq('target_user_id', authUser.id)
      .single()

    if (!budget) {
      return NextResponse.json(
        { detail: 'Presupuesto no encontrado' },
        { status: 404 }
      )
    }

    // Eliminar user_budgets asociados
    await supabase
      .from('user_budgets')
      .delete()
      .eq('family_budget_id', budgetId)

    // Eliminar presupuesto
    const { error: deleteError } = await supabase
      .from('family_budgets')
      .delete()
      .eq('id', budgetId)

    if (deleteError) {
      console.error('Error eliminando presupuesto:', deleteError)
      return NextResponse.json(
        { detail: `Error al eliminar presupuesto: ${deleteError.message}` },
        { status: 500 }
      )
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budget_deleted',
        entity_type: 'budget',
        description: `Presupuesto personal eliminado: ${budget.category} - ${budget.subcategory}`,
        entity_id: budgetId,
        details: {
          category: budget.category,
          subcategory: budget.subcategory,
        },
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json(
      { message: 'Presupuesto eliminado exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error en DELETE /api/personal-budgets/[id]:', error)
    return NextResponse.json(
      { detail: `Error al eliminar presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
