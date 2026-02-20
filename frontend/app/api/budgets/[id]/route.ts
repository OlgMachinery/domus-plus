import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single()

    const { data: budget, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name, email)
        ),
        target_user:users!family_budgets_target_user_id_fkey(id, name, email)
      `)
      .eq('id', parseInt(id))
      .eq('family_id', userData?.family_id)
      .single()

    if (error || !budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    return NextResponse.json(budget)
  } catch (error) {
    console.error('Error fetching budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', user.id)
      .single()

    if (!userData?.is_family_admin) {
      return NextResponse.json({ error: 'Only admin can update budgets' }, { status: 403 })
    }

    const { data: existingBudget } = await supabase
      .from('family_budgets')
      .select('family_id')
      .eq('id', parseInt(id))
      .single()

    if (!existingBudget || existingBudget.family_id !== userData.family_id) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.category !== undefined) updateData.category = body.category
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
    if (body.year !== undefined) updateData.year = body.year
    if (body.total_amount !== undefined) updateData.total_amount = body.total_amount
    if (body.monthly_amounts !== undefined) updateData.monthly_amounts = body.monthly_amounts
    if (body.budget_type !== undefined) updateData.budget_type = body.budget_type
    if (body.distribution_method !== undefined) updateData.distribution_method = body.distribution_method
    if (body.auto_distribute !== undefined) updateData.auto_distribute = body.auto_distribute
    if (body.target_user_id !== undefined) updateData.target_user_id = body.target_user_id
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.due_date !== undefined) updateData.due_date = body.due_date
    if (body.payment_status !== undefined) updateData.payment_status = body.payment_status

    const { data: budget, error } = await supabase
      .from('family_budgets')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'budget_updated',
      entity_type: 'budget',
      entity_id: budget.id,
      description: `Budget updated: ${budget.category} - ${budget.subcategory}`,
      details: updateData,
    })

    return NextResponse.json(budget)
  } catch (error) {
    console.error('Error updating budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', user.id)
      .single()

    if (!userData?.is_family_admin) {
      return NextResponse.json({ error: 'Only admin can delete budgets' }, { status: 403 })
    }

    const { data: existingBudget } = await supabase
      .from('family_budgets')
      .select('family_id, category, subcategory')
      .eq('id', parseInt(id))
      .single()

    if (!existingBudget || existingBudget.family_id !== userData.family_id) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('family_budgets')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'budget_deleted',
      entity_type: 'budget',
      entity_id: parseInt(id),
      description: `Budget deleted: ${existingBudget.category} - ${existingBudget.subcategory}`,
    })

    return NextResponse.json({ message: 'Budget deleted successfully' })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
