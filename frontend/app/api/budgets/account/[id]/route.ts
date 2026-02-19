import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const accountId = parseInt(params.id)
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
        { detail: 'Solo los administradores pueden modificar cuentas' },
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

    // Preparar actualizaciones
    const updateData: any = {}
    if (updates.total_amount !== undefined) {
      updateData.total_amount = parseFloat(updates.total_amount)
    }
    if (updates.monthly_amounts !== undefined) {
      updateData.monthly_amounts = updates.monthly_amounts
    }
    if (updates.due_date !== undefined) {
      updateData.due_date = updates.due_date || null
    }
    if (updates.payment_status !== undefined) {
      updateData.payment_status = updates.payment_status
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes
    }
    if (updates.display_names !== undefined) {
      updateData.display_names = updates.display_names
    }

    const { data: updatedBudget, error: updateError } = await supabase
      .from('family_budgets')
      .update(updateData)
      .eq('id', accountId)
      .select()
      .single()

    if (updateError) {
      console.error('Error actualizando cuenta:', updateError)
      return NextResponse.json(
        { detail: `Error al actualizar cuenta: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budget_account_updated',
        entity_type: 'budget',
        description: `Cuenta actualizada: ${updatedBudget.category} - ${updatedBudget.subcategory}`,
        entity_id: updatedBudget.id,
        details: updates,
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json({
      id: updatedBudget.id,
      total_amount: updatedBudget.total_amount,
      due_date: updatedBudget.due_date,
      payment_status: updatedBudget.payment_status,
      notes: updatedBudget.notes,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/budgets/account/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar cuenta: ${error.message}` },
      { status: 500 }
    )
  }
}
