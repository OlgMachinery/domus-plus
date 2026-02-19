import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { optimizeBudgetAllocation } from '@/lib/services/ai-assistant'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener presupuestos actuales
    const { data: userBudgets } = await supabase
      .from('user_budgets')
      .select(`
        *,
        family_budget:family_budgets(category)
      `)
      .eq('user_id', authUser.id)

    const currentBudgets: any[] = []
    let totalBudget = 0

    for (const ub of userBudgets || []) {
      if (ub.family_budget) {
        currentBudgets.push({
          category: ub.family_budget.category || 'N/A',
          allocated: parseFloat(ub.allocated_amount || 0),
        })
        totalBudget += parseFloat(ub.allocated_amount || 0)
      }
    }

    // Obtener gastos reales por categoría
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('user_id', authUser.id)
      .eq('transaction_type', 'expense')

    const categorySpending: Record<string, number> = {}
    for (const t of transactions || []) {
      const cat = t.category || 'Desconocida'
      categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(t.amount || 0)
    }

    const actualSpending = Object.entries(categorySpending).map(([cat, amount]) => ({
      category: cat,
      spent: amount,
    }))

    // Optimizar
    const optimizations = await optimizeBudgetAllocation(currentBudgets, actualSpending, totalBudget)

    return NextResponse.json(optimizations, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/ai-assistant/optimize-budget:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
