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
    const year = searchParams.get('year')

    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', user.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json({ error: 'User does not belong to a family' }, { status: 400 })
    }

    let query = supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name, email)
        ),
        target_user:users!family_budgets_target_user_id_fkey(id, name, email),
        custom_category:custom_categories(id, name, icon, color),
        custom_subcategory:custom_subcategories(id, name)
      `)
      .eq('family_id', userData.family_id)

    if (year) {
      query = query.eq('year', parseInt(year))
    }

    const { data: budgets, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(budgets)
  } catch (error) {
    console.error('Error fetching budgets:', error)
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

    const { data: userData } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', user.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json({ error: 'User does not belong to a family' }, { status: 400 })
    }

    if (!userData.is_family_admin) {
      return NextResponse.json({ error: 'Only admin can create budgets' }, { status: 403 })
    }

    if (body.total_amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    const currentYear = new Date().getFullYear()
    if (body.year < currentYear - 1 || body.year > currentYear + 1) {
      return NextResponse.json({ error: 'Year must be current, previous, or next year' }, { status: 400 })
    }

    const budgetType = body.budget_type || 'shared'
    const distributionMethod = body.distribution_method || 'equal'

    if (budgetType === 'individual' && !body.target_user_id) {
      return NextResponse.json({ error: 'Individual budgets require target_user_id' }, { status: 400 })
    }

    const { data: budget, error: insertError } = await supabase
      .from('family_budgets')
      .insert({
        family_id: userData.family_id,
        category: body.category,
        subcategory: body.subcategory,
        custom_category_id: body.custom_category_id,
        custom_subcategory_id: body.custom_subcategory_id,
        year: body.year,
        total_amount: body.total_amount,
        monthly_amounts: body.monthly_amounts,
        budget_type: budgetType,
        distribution_method: distributionMethod,
        auto_distribute: body.auto_distribute ?? true,
        target_user_id: body.target_user_id,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    if (body.auto_distribute !== false && budgetType === 'shared') {
      const { data: familyMembers } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', userData.family_id)

      if (familyMembers && familyMembers.length > 0) {
        const amountPerUser = body.total_amount / familyMembers.length
        const userBudgets = familyMembers.map(member => ({
          user_id: member.id,
          family_budget_id: budget.id,
          allocated_amount: Math.round(amountPerUser * 100) / 100,
          spent_amount: 0,
        }))

        await supabase.from('user_budgets').insert(userBudgets)
      }
    } else if (budgetType === 'individual' && body.target_user_id) {
      await supabase.from('user_budgets').insert({
        user_id: body.target_user_id,
        family_budget_id: budget.id,
        allocated_amount: body.total_amount,
        spent_amount: 0,
      })
    }

    await supabase.from('activity_logs').insert({
      user_id: user.id,
      action_type: 'budget_created',
      entity_type: 'budget',
      entity_id: budget.id,
      description: `Budget created: ${body.category || 'Custom'} - ${body.subcategory || 'Custom'} ($${body.total_amount})`,
      details: {
        category: body.category,
        subcategory: body.subcategory,
        year: body.year,
        total_amount: body.total_amount,
        budget_type: budgetType,
      },
    })

    return NextResponse.json(budget, { status: 201 })
  } catch (error) {
    console.error('Error creating budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
