import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json({ error: 'User does not belong to a family' }, { status: 400 })
    }

    const { data: budgets, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name)
        ),
        target_user:users!family_budgets_target_user_id_fkey(id, name)
      `)
      .eq('family_id', userData.family_id)
      .eq('year', parseInt(year))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const summary: Record<string, {
      category: string
      subcategory: string
      shared_amount: number
      individual_amounts: Record<string, { amount: number; name: string }>
      total_amount: number
    }> = {}

    for (const budget of budgets || []) {
      const key = `${budget.category}|${budget.subcategory}`

      if (!summary[key]) {
        summary[key] = {
          category: budget.category,
          subcategory: budget.subcategory,
          shared_amount: 0,
          individual_amounts: {},
          total_amount: 0,
        }
      }

      if (budget.budget_type === 'shared') {
        summary[key].shared_amount += budget.total_amount
      } else if (budget.budget_type === 'individual' && budget.target_user) {
        const userId = budget.target_user.id
        if (!summary[key].individual_amounts[userId]) {
          summary[key].individual_amounts[userId] = {
            amount: 0,
            name: budget.target_user.name,
          }
        }
        summary[key].individual_amounts[userId].amount += budget.total_amount
      }

      summary[key].total_amount += budget.total_amount
    }

    const summaryList = Object.values(summary).map(data => ({
      ...data,
      individual_total: Object.values(data.individual_amounts).reduce(
        (sum, u) => sum + u.amount,
        0
      ),
    }))

    const totals = {
      shared: summaryList.reduce((sum, s) => sum + s.shared_amount, 0),
      individual: summaryList.reduce((sum, s) => sum + s.individual_total, 0),
      global: summaryList.reduce((sum, s) => sum + s.total_amount, 0),
    }

    return NextResponse.json({
      year: parseInt(year),
      summary: summaryList,
      totals,
    })
  } catch (error) {
    console.error('Error fetching budget summary:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
