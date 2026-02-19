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
        target_user:users!target_user_id(id, name)
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

    // Agrupar por categoría y subcategoría
    const summary: Record<string, any> = {}

    for (const budget of budgets || []) {
      const key = `${budget.category}|${budget.subcategory}`
      
      if (!summary[key]) {
        summary[key] = {
          category: budget.category,
          subcategory: budget.subcategory,
          shared_amount: 0.0,
          individual_amounts: {},
          total_amount: 0.0,
        }
      }

      if (budget.budget_type === 'shared') {
        summary[key].shared_amount += budget.total_amount || 0
      } else if (budget.budget_type === 'individual' && budget.target_user) {
        const userId = budget.target_user.id
        const userName = budget.target_user.name
        
        if (!summary[key].individual_amounts[userId]) {
          summary[key].individual_amounts[userId] = {
            amount: 0.0,
            name: userName,
          }
        }
        summary[key].individual_amounts[userId].amount += budget.total_amount || 0
      }

      summary[key].total_amount += budget.total_amount || 0
    }

    // Convertir a lista y calcular totales
    const summaryList = []
    let totalShared = 0.0
    let totalIndividual = 0.0
    let totalGlobal = 0.0

    for (const key in summary) {
      const data = summary[key]
      const individualTotal = Object.values(data.individual_amounts).reduce(
        (sum: number, userData: any) => sum + (userData.amount || 0),
        0
      ) as number

      totalShared += data.shared_amount
      totalIndividual += individualTotal
      totalGlobal += data.total_amount

      summaryList.push({
        ...data,
        individual_total: Math.round(individualTotal * 100) / 100,
      })
    }

    return NextResponse.json({
      year,
      summary: summaryList,
      totals: {
        shared: Math.round(totalShared * 100) / 100,
        individual: Math.round(totalIndividual * 100) / 100,
        global: Math.round(totalGlobal * 100) / 100,
      },
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/global-summary:', error)
    return NextResponse.json(
      { detail: `Error al obtener resumen global: ${error.message}` },
      { status: 500 }
    )
  }
}
