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
      .select('*')
      .eq('family_id', userData.family_id)
      .eq('year', year)
      .order('category')
      .order('subcategory')

    if (budgetsError) {
      console.error('Error obteniendo presupuestos:', budgetsError)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${budgetsError.message}` },
        { status: 500 }
      )
    }

    // Meses en español
    const mesesEs = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ]

    // Mapeo de meses en inglés (del Excel) a español
    const mesesEn = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ]
    const mesMapping: Record<string, string> = {}
    mesesEn.forEach((en, idx) => {
      mesMapping[en] = mesesEs[idx]
    })

    // Construir la matriz
    const matrix: any[] = []
    let totalAnual = 0.0
    const totalesMensuales: Record<string, number> = {}
    mesesEs.forEach(mes => {
      totalesMensuales[mes] = 0.0
    })

    for (const budget of budgets || []) {
      const row: any = {
        concepto: `${budget.category} - ${budget.subcategory}`,
        categoria: budget.category,
        subcategoria: budget.subcategory,
        meses: {},
      }

      // Usar montos mensuales reales si están disponibles
      let monthlyAmountsDict: Record<string, number> | null = null
      if (budget.monthly_amounts) {
        if (typeof budget.monthly_amounts === 'string') {
          try {
            monthlyAmountsDict = JSON.parse(budget.monthly_amounts)
          } catch {
            monthlyAmountsDict = null
          }
        } else if (typeof budget.monthly_amounts === 'object') {
          monthlyAmountsDict = budget.monthly_amounts as Record<string, number>
        }
      }

      if (monthlyAmountsDict && Object.keys(monthlyAmountsDict).length > 0) {
        // Hay montos mensuales reales del Excel
        for (const mesEn in monthlyAmountsDict) {
          const mesEs = mesMapping[mesEn.toUpperCase()]
          if (mesEs) {
            const monto = parseFloat(String(monthlyAmountsDict[mesEn])) || 0
            row.meses[mesEs] = Math.round(monto * 100) / 100
            totalesMensuales[mesEs] += monto
          }
        }
        // Rellenar meses faltantes con 0
        mesesEs.forEach(mesEs => {
          if (!row.meses[mesEs]) {
            row.meses[mesEs] = 0.0
          }
        })
      } else {
        // No hay montos mensuales, dividir el total entre 12
        const montoMensual = (budget.total_amount || 0) / 12.0
        mesesEs.forEach(mesEs => {
          row.meses[mesEs] = Math.round(montoMensual * 100) / 100
          totalesMensuales[mesEs] += montoMensual
        })
      }

      // Total anual para este concepto
      row.total_anual = Math.round((budget.total_amount || 0) * 100) / 100
      totalAnual += budget.total_amount || 0

      matrix.push(row)
    }

    // Agregar fila de totales
    const totalesRow: any = {
      concepto: 'TOTAL',
      categoria: '',
      subcategoria: '',
      meses: {},
      total_anual: Math.round(totalAnual * 100) / 100,
    }

    mesesEs.forEach(mes => {
      totalesRow.meses[mes] = Math.round(totalesMensuales[mes] * 100) / 100
    })

    matrix.push(totalesRow)

    return NextResponse.json({
      year,
      meses: mesesEs,
      matrix,
      total_conceptos: budgets?.length || 0,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/annual-matrix:', error)
    return NextResponse.json(
      { detail: `Error al obtener matriz de presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
