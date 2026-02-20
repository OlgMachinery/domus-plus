import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
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

    if (!body.family_budget_id) {
      return NextResponse.json({ error: 'family_budget_id is required' }, { status: 400 })
    }

    const { data: receipt } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', parseInt(id))
      .eq('user_id', user.id)
      .single()

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single()

    const { data: familyBudget } = await supabase
      .from('family_budgets')
      .select('id, family_id')
      .eq('id', body.family_budget_id)
      .eq('family_id', userData?.family_id)
      .single()

    if (!familyBudget) {
      return NextResponse.json({ error: 'Budget not found or access denied' }, { status: 404 })
    }

    let usersToAssign: { id: string }[] = []

    if (body.assign_to_all || !body.target_user_id) {
      const { data: familyUsers } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', userData?.family_id)
        .eq('is_active', true)

      usersToAssign = familyUsers || []
    } else {
      const { data: targetUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', body.target_user_id)
        .eq('family_id', userData?.family_id)
        .single()

      if (!targetUser) {
        return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
      }
      usersToAssign = [targetUser]
    }

    if (usersToAssign.length === 0) {
      return NextResponse.json({ error: 'No users to assign' }, { status: 400 })
    }

    const percentage = body.percentage || 100
    const amountPerUser = (receipt.amount * percentage / 100) / usersToAssign.length
    const createdTransactions: number[] = []

    let transactionDate = new Date()
    if (receipt.date) {
      try {
        const dateStr = receipt.time
          ? `${receipt.date}T${receipt.time}`
          : receipt.date
        transactionDate = new Date(dateStr)
      } catch {
        transactionDate = new Date()
      }
    }

    for (const assignUser of usersToAssign) {
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: assignUser.id,
          family_budget_id: body.family_budget_id,
          date: transactionDate.toISOString(),
          amount: Math.round(amountPerUser * 100) / 100,
          transaction_type: 'expense',
          currency: receipt.currency || 'MXN',
          merchant_or_beneficiary: receipt.merchant_or_beneficiary,
          category: receipt.category,
          subcategory: receipt.subcategory,
          concept: receipt.concept || `Receipt ${receipt.merchant_or_beneficiary || 'unknown'}`,
          reference: receipt.reference,
          operation_id: receipt.operation_id,
          tracking_key: receipt.tracking_key,
          notes: receipt.notes,
          status: 'processed',
        })
        .select('id')
        .single()

      if (!txError && transaction) {
        createdTransactions.push(transaction.id)

        const { data: userBudget } = await supabase
          .from('user_budgets')
          .select('id, spent_amount')
          .eq('user_id', assignUser.id)
          .eq('family_budget_id', body.family_budget_id)
          .single()

        if (userBudget) {
          await supabase
            .from('user_budgets')
            .update({ spent_amount: (userBudget.spent_amount || 0) + amountPerUser })
            .eq('id', userBudget.id)
        }
      }
    }

    if (createdTransactions.length > 0) {
      await supabase
        .from('receipts')
        .update({
          assigned_transaction_id: createdTransactions[0],
          status: 'assigned',
        })
        .eq('id', parseInt(id))

      const { data: items } = await supabase
        .from('receipt_items')
        .select('id')
        .eq('receipt_id', parseInt(id))

      if (items && items.length > 0) {
        const itemsPerTx = Math.ceil(items.length / createdTransactions.length)
        for (let i = 0; i < items.length; i++) {
          const txIndex = Math.min(Math.floor(i / itemsPerTx), createdTransactions.length - 1)
          await supabase
            .from('receipt_items')
            .update({ assigned_transaction_id: createdTransactions[txIndex] })
            .eq('id', items[i].id)
        }
      }
    }

    const { data: updatedReceipt } = await supabase
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .eq('id', parseInt(id))
      .single()

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'receipt_assigned',
      entity_type: 'receipt',
      entity_id: parseInt(id),
      description: `Receipt assigned to budget ${body.family_budget_id}`,
      details: {
        family_budget_id: body.family_budget_id,
        users_count: usersToAssign.length,
        amount_per_user: amountPerUser,
        transactions_created: createdTransactions.length,
      },
    })

    return NextResponse.json({
      message: 'Receipt assigned successfully',
      receipt: updatedReceipt,
      transactions_created: createdTransactions.length,
    })
  } catch (error) {
    console.error('Error assigning receipt:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
