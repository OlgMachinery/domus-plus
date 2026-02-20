import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const transactionType = searchParams.get('transaction_type')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', category)
    }
    if (transactionType) {
      query = query.eq('transaction_type', transactionType)
    }
    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data: transactions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (body.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    if (body.amount > 1000000000) {
      return NextResponse.json({ error: 'Amount exceeds limit' }, { status: 400 })
    }

    if (body.family_budget_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('family_id')
        .eq('id', user.id)
        .single()

      const { data: budget } = await supabase
        .from('family_budgets')
        .select('family_id')
        .eq('id', body.family_budget_id)
        .single()

      if (!budget || budget.family_id !== userData?.family_id) {
        return NextResponse.json({ error: 'Budget not found or access denied' }, { status: 403 })
      }
    }

    const { data: transaction, error: insertError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        family_budget_id: body.family_budget_id,
        date: body.date,
        amount: body.amount,
        transaction_type: body.transaction_type || 'expense',
        currency: body.currency || 'MXN',
        merchant_or_beneficiary: body.merchant_or_beneficiary,
        category: body.category,
        subcategory: body.subcategory,
        custom_category_id: body.custom_category_id,
        custom_subcategory_id: body.custom_subcategory_id,
        concept: body.concept,
        reference: body.reference,
        operation_id: body.operation_id,
        tracking_key: body.tracking_key,
        notes: body.notes,
        status: 'processed',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    if (body.family_budget_id) {
      const { data: userBudget } = await supabase
        .from('user_budgets')
        .select('id, spent_amount')
        .eq('user_id', user.id)
        .eq('family_budget_id', body.family_budget_id)
        .single()

      if (userBudget) {
        const newSpent = body.transaction_type === 'expense'
          ? (userBudget.spent_amount || 0) + body.amount
          : userBudget.spent_amount

        await supabase
          .from('user_budgets')
          .update({ spent_amount: newSpent })
          .eq('id', userBudget.id)
      }
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'transaction_created',
      entity_type: 'transaction',
      entity_id: transaction.id,
      description: `Transaction created: ${body.transaction_type} $${body.amount} - ${body.category}`,
      details: {
        transaction_type: body.transaction_type,
        amount: body.amount,
        category: body.category,
        subcategory: body.subcategory,
      },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
