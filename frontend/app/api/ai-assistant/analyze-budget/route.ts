import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeBudgetSituation } from '@/lib/services/ai-assistant'

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

    // Obtener datos del presupuesto
    let budgetData: any = {}
    let transactions: any[] = []

    if (body.budget_id) {
      // Presupuesto específico
      const { data: userBudget } = await supabase
        .from('user_budgets')
        .select('*')
        .eq('id', body.budget_id)
        .eq('user_id', authUser.id)
        .single()

      if (!userBudget) {
        return NextResponse.json(
          { detail: 'Presupuesto no encontrado' },
          { status: 404 }
        )
      }

      budgetData = {
        total: userBudget.allocated_amount || 0,
        spent: userBudget.spent_amount || 0,
        available: (userBudget.allocated_amount || 0) - (userBudget.spent_amount || 0),
      }

      if (body.include_transactions !== false) {
        const { data: trans } = await supabase
          .from('transactions')
          .select('concept, amount, category, date')
          .eq('family_budget_id', userBudget.family_budget_id)
          .eq('user_id', authUser.id)
          .order('date', { ascending: false })
          .limit(10)

        transactions = (trans || []).map((t: any) => ({
          description: t.concept || 'Sin descripción',
          amount: parseFloat(t.amount || 0),
          category: t.category || 'N/A',
        }))
      }
    } else {
      // Todos los presupuestos del usuario
      const { data: userBudgets } = await supabase
        .from('user_budgets')
        .select('allocated_amount, spent_amount')
        .eq('user_id', authUser.id)

      const totalBudget = userBudgets?.reduce((sum, ub) => sum + (ub.allocated_amount || 0), 0) || 0
      const totalSpent = userBudgets?.reduce((sum, ub) => sum + (ub.spent_amount || 0), 0) || 0

      budgetData = {
        total: totalBudget,
        spent: totalSpent,
        available: totalBudget - totalSpent,
      }

      if (body.include_transactions !== false) {
        const { data: trans } = await supabase
          .from('transactions')
          .select('concept, amount, category, date')
          .eq('user_id', authUser.id)
          .order('date', { ascending: false })
          .limit(10)

        transactions = (trans || []).map((t: any) => ({
          description: t.concept || 'Sin descripción',
          amount: parseFloat(t.amount || 0),
          category: t.category || 'N/A',
        }))
      }
    }

    // Obtener análisis
    const analysis = await analyzeBudgetSituation(budgetData, transactions)

    return NextResponse.json({
      analysis,
      budget_data: budgetData,
      transactions_count: transactions.length,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/ai-assistant/analyze-budget:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
