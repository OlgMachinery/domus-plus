import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectAnomalies } from '@/lib/services/ai-assistant'

export const dynamic = 'force-dynamic'

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

    const limit = parseInt(body.limit || '50')

    // Obtener transacciones
    let query = supabase
      .from('transactions')
      .select('concept, amount, category, date')
      .eq('user_id', authUser.id)
      .eq('transaction_type', 'expense')
      .order('date', { ascending: false })
      .limit(limit)

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

    // Obtener datos de presupuesto si está disponible
    let budgetData: any = undefined
    if (body.budget_id) {
      const { data: userBudget } = await supabase
        .from('user_budgets')
        .select('allocated_amount, spent_amount')
        .eq('id', body.budget_id)
        .eq('user_id', authUser.id)
        .single()

      if (userBudget) {
        budgetData = {
          total: userBudget.allocated_amount || 0,
          spent: userBudget.spent_amount || 0,
          available: (userBudget.allocated_amount || 0) - (userBudget.spent_amount || 0),
        }
      }
    }

    // Detectar anomalías
    const result = await detectAnomalies(transactions, budgetData)

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/ai-assistant/detect-anomalies:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
