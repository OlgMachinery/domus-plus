import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', parseInt(id))
      .eq('user_id', user.id)
      .single()

    if (error || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error fetching transaction:', error)
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

    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', parseInt(id))
      .eq('user_id', user.id)
      .single()

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.amount !== undefined) {
      if (body.amount <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
      }
      updateData.amount = body.amount
    }
    if (body.date !== undefined) updateData.date = body.date
    if (body.concept !== undefined) updateData.concept = body.concept
    if (body.merchant_or_beneficiary !== undefined) updateData.merchant_or_beneficiary = body.merchant_or_beneficiary
    if (body.category !== undefined) updateData.category = body.category
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
    if (body.transaction_type !== undefined) updateData.transaction_type = body.transaction_type
    if (body.family_budget_id !== undefined) updateData.family_budget_id = body.family_budget_id
    if (body.notes !== undefined) updateData.notes = body.notes

    const oldBudgetId = existingTransaction.family_budget_id
    const oldAmount = existingTransaction.amount
    const oldType = existingTransaction.transaction_type

    if (oldBudgetId) {
      const { data: oldUserBudget } = await supabase
        .from('user_budgets')
        .select('id, spent_amount')
        .eq('user_id', user.id)
        .eq('family_budget_id', oldBudgetId)
        .single()

      if (oldUserBudget && oldType === 'expense') {
        await supabase
          .from('user_budgets')
          .update({ spent_amount: Math.max(0, (oldUserBudget.spent_amount || 0) - oldAmount) })
          .eq('id', oldUserBudget.id)
      }
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const newBudgetId = transaction.family_budget_id
    if (newBudgetId && transaction.transaction_type === 'expense') {
      const { data: newUserBudget } = await supabase
        .from('user_budgets')
        .select('id, spent_amount')
        .eq('user_id', user.id)
        .eq('family_budget_id', newBudgetId)
        .single()

      if (newUserBudget) {
        await supabase
          .from('user_budgets')
          .update({ spent_amount: (newUserBudget.spent_amount || 0) + transaction.amount })
          .eq('id', newUserBudget.id)
      }
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'transaction_updated',
      entity_type: 'transaction',
      entity_id: transaction.id,
      description: `Transaction updated: ${transaction.transaction_type} $${transaction.amount}`,
      details: updateData,
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error updating transaction:', error)
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

    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', parseInt(id))
      .eq('user_id', user.id)
      .single()

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    if (existingTransaction.family_budget_id && existingTransaction.transaction_type === 'expense') {
      const { data: userBudget } = await supabase
        .from('user_budgets')
        .select('id, spent_amount')
        .eq('user_id', user.id)
        .eq('family_budget_id', existingTransaction.family_budget_id)
        .single()

      if (userBudget) {
        await supabase
          .from('user_budgets')
          .update({ spent_amount: Math.max(0, (userBudget.spent_amount || 0) - existingTransaction.amount) })
          .eq('id', userBudget.id)
      }
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'transaction_deleted',
      entity_type: 'transaction',
      entity_id: parseInt(id),
      description: `Transaction deleted: ${existingTransaction.transaction_type} $${existingTransaction.amount}`,
    })

    return NextResponse.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
