import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    // Obtener presupuestos personales (individuales) del usuario
    const { data: budgets, error } = await supabase
      .from('family_budgets')
      .select(`
        *,
        user_allocations:user_budgets(
          *,
          user:users(id, name, email)
        )
      `)
      .eq('budget_type', 'individual')
      .eq('target_user_id', authUser.id)
      .eq('year', year)
      .order('category')
      .order('subcategory')

    if (error) {
      console.error('Error obteniendo presupuestos personales:', error)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${error.message}` },
        { status: 500 }
      )
    }

    // Calcular income_amount y available_amount para cada user_budget
    if (budgets) {
      for (const budget of budgets) {
        if (budget.user_allocations) {
          for (const allocation of budget.user_allocations) {
            // Obtener income_amount desde transacciones
            const { data: incomeTransactions } = await supabase
              .from('transactions')
              .select('amount')
              .eq('family_budget_id', budget.id)
              .eq('user_id', allocation.user_id)
              .eq('transaction_type', 'income')

            const incomeAmount = incomeTransactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

            // Calcular available_amount
            allocation.income_amount = incomeAmount
            allocation.available_amount = 
              (allocation.allocated_amount || 0) + 
              incomeAmount - 
              (allocation.spent_amount || 0)
          }
        }
      }
    }

    return NextResponse.json(budgets || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/personal-budgets:', error)
    return NextResponse.json(
      { detail: `Error al obtener presupuestos: ${error.message}` },
      { status: 500 }
    )
  }
}

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

    // Obtener usuario completo
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

    // Validaciones
    if (!body.total_amount || body.total_amount <= 0) {
      return NextResponse.json(
        { detail: 'El monto debe ser mayor a cero' },
        { status: 400 }
      )
    }

    if (body.total_amount > 1000000000) {
      return NextResponse.json(
        { detail: 'El monto excede el límite permitido' },
        { status: 400 }
      )
    }

    const currentYear = new Date().getFullYear()
    if (body.year < currentYear - 1 || body.year > currentYear + 1) {
      return NextResponse.json(
        { detail: 'El año debe ser el actual, anterior o siguiente' },
        { status: 400 }
      )
    }

    // Crear presupuesto personal (individual)
    const budgetData: any = {
      family_id: userData.family_id,
      category: body.category || null,
      subcategory: body.subcategory || null,
      custom_category_id: body.custom_category_id || null,
      custom_subcategory_id: body.custom_subcategory_id || null,
      year: body.year,
      total_amount: body.total_amount,
      monthly_amounts: body.monthly_amounts || null,
      display_names: body.display_names || null,
      due_date: body.due_date || null,
      payment_status: body.payment_status || 'pending',
      notes: body.notes || null,
      budget_type: 'individual', // Siempre individual para presupuestos personales
      distribution_method: 'equal',
      auto_distribute: false,
      target_user_id: authUser.id, // Siempre el usuario actual
    }

    const { data: budget, error: budgetError } = await supabase
      .from('family_budgets')
      .insert(budgetData)
      .select()
      .single()

    if (budgetError) {
      console.error('Error creando presupuesto personal:', budgetError)
      return NextResponse.json(
        { detail: `Error al crear presupuesto: ${budgetError.message}` },
        { status: 500 }
      )
    }

    // Asignar directamente al usuario
    await supabase
      .from('user_budgets')
      .insert({
        user_id: authUser.id,
        family_budget_id: budget.id,
        allocated_amount: body.total_amount,
      })

    // Crear log de actividad
    try {
      await supabase.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'budget_created',
        entity_type: 'budget',
        description: `Presupuesto personal creado: ${body.category} - ${body.subcategory} ($${body.total_amount})`,
        entity_id: budget.id,
        details: {
          category: body.category,
          subcategory: body.subcategory,
          year: body.year,
          total_amount: body.total_amount,
          budget_type: 'individual',
        },
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json(budget, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/personal-budgets:', error)
    return NextResponse.json(
      { detail: `Error al crear presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
