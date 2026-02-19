import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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

    // Obtener familia del usuario
    const { data: userData } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    if (!userData?.family_id) {
      return NextResponse.json(
        { detail: 'Usuario no pertenece a una familia' },
        { status: 400 }
      )
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    // Obtener todos los presupuestos del año
    const { data: budgets, error: budgetsError } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name, email)
        )
      `)
      .eq('family_id', userData.family_id)
      .eq('year', year)

    if (budgetsError) {
      console.error('Error obteniendo presupuestos:', budgetsError)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${budgetsError.message}` },
        { status: 500 }
      )
    }

    // Obtener transacciones para calcular montos pagados
    const budgetIds = budgets?.map(b => b.id) || []
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .in('family_budget_id', budgetIds)

    // Procesar cada presupuesto
    const accounts = (budgets || []).map((budget: any) => {
      // Calcular contribuyentes
      const contributors = (budget.user_allocations || []).map((alloc: any) => {
        const total = budget.total_amount || 0
        const percentage = total > 0 ? (alloc.allocated_amount / total * 100) : 0
        return {
          user_id: alloc.user_id,
          user_name: alloc.user?.name || '',
          allocated_amount: alloc.allocated_amount || 0,
          percentage: Math.round(percentage * 100) / 100,
        }
      })

      // Calcular montos pagados y restantes
      const budgetTransactions = transactions?.filter(
        (t: any) => t.family_budget_id === budget.id
      ) || []

      let totalPaid = 0
      let totalIncome = 0
      const movements = budgetTransactions.map((t: any) => {
        if (t.transaction_type === 'expense') {
          totalPaid += t.amount || 0
        } else if (t.transaction_type === 'income') {
          totalIncome += t.amount || 0
        }
        return {
          id: t.id,
          date: t.date,
          amount: t.amount,
          type: t.transaction_type,
          merchant_or_beneficiary: t.merchant_or_beneficiary,
          concept: t.concept,
          status: t.status,
        }
      })

      const remainingAmount = Math.max(0, budget.total_amount - totalPaid + totalIncome)
      const monthlyAmount = budget.total_amount / 12.0

      // Parsear display_names si es string
      let displayNames = budget.display_names
      if (typeof displayNames === 'string') {
        try {
          displayNames = JSON.parse(displayNames)
        } catch {
          displayNames = {}
        }
      }

      // Determinar estado de pago
      let paymentStatus = budget.payment_status || 'pending'
      if (!paymentStatus) {
        if (totalPaid >= budget.total_amount) {
          paymentStatus = 'paid'
        } else if (totalPaid > 0) {
          paymentStatus = 'partial'
        } else {
          paymentStatus = 'pending'
        }
      }

      // Verificar si está vencido
      let isOverdue = false
      if (budget.due_date) {
        const dueDate = new Date(budget.due_date)
        const now = new Date()
        if (dueDate < now && paymentStatus !== 'paid') {
          isOverdue = true
          paymentStatus = 'overdue'
        }
      }

      return {
        id: budget.id,
        category: budget.category,
        subcategory: budget.subcategory,
        category_display_name: displayNames?.category || null,
        subcategory_display_name: displayNames?.subcategory || null,
        total_amount: budget.total_amount,
        monthly_amount: Math.round(monthlyAmount * 100) / 100,
        paid_amount: Math.round(totalPaid * 100) / 100,
        remaining_amount: Math.round(remainingAmount * 100) / 100,
        income_amount: Math.round(totalIncome * 100) / 100,
        movements_count: movements.length,
        movements: movements,
        due_date: budget.due_date,
        payment_status: paymentStatus,
        is_overdue: isOverdue,
        budget_type: budget.budget_type,
        distribution_method: budget.distribution_method,
        contributors_count: contributors.length,
        contributors: contributors,
        notes: budget.notes,
        year: budget.year,
      }
    })

    // Ordenar alfabéticamente
    accounts.sort((a, b) => {
      const catA = (a.category_display_name || a.category || '').toLowerCase()
      const catB = (b.category_display_name || b.category || '').toLowerCase()
      if (catA !== catB) return catA.localeCompare(catB)
      const subA = (a.subcategory_display_name || a.subcategory || '').toLowerCase()
      const subB = (b.subcategory_display_name || b.subcategory || '').toLowerCase()
      return subA.localeCompare(subB)
    })

    return NextResponse.json(accounts, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/summary:', error)
    return NextResponse.json(
      { detail: `Error al obtener resumen: ${error.message}` },
      { status: 500 }
    )
  }
}
