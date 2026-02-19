import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { predictFutureExpenses } from '@/lib/services/ai-assistant'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const monthsAhead = parseInt(body.months_ahead || '3')

    // Obtener transacciones históricas (últimos 12 meses)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    let query = supabase
      .from('transactions')
      .select('concept, amount, category, date')
      .eq('user_id', authUser.id)
      .eq('transaction_type', 'expense')
      .gte('date', oneYearAgo.toISOString())
      .order('date', { ascending: false })

    if (body.budget_id) {
      const { data: userBudget } = await supabase
        .from('user_budgets')
        .select('family_budget_id')
        .eq('id', body.budget_id)
        .eq('user_id', authUser.id)
        .single()

      if (userBudget) {
        query = query.eq('family_budget_id', userBudget.family_budget_id)
      }
    }

    const { data: trans } = await query

    const transactions = (trans || []).map((t: any) => ({
      description: t.concept || 'Sin descripción',
      amount: parseFloat(t.amount || 0),
      category: t.category || 'N/A',
      date: t.date,
    }))

    // Predecir gastos
    const predictions = await predictFutureExpenses(transactions, monthsAhead)

    return NextResponse.json(predictions, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/ai-assistant/predict-expenses:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
