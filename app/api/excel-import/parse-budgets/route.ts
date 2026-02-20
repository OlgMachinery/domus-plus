import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseExcelBudgets } from '@/lib/services/excel-parser'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    let authUser = null
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    if (accessToken) {
      const { data: { user }, error: tokenError } = await supabase.auth.getUser(accessToken)
      if (user && !tokenError) {
        authUser = user
      }
    }
    
    if (!authUser) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (user && !userError) {
        authUser = user
      } else {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (session?.user && !sessionError) {
          authUser = session.user
        }
      }
    }
    
    if (!authUser) {
      return NextResponse.json(
        { detail: 'No autenticado. Por favor, inicia sesión de nuevo.' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { detail: 'No se proporcionó un archivo' },
        { status: 400 }
      )
    }

    const validExtensions = ['.xlsx', '.xlsm', '.xls']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))

    if (!hasValidExtension) {
      return NextResponse.json(
        { detail: 'El archivo debe ser Excel (.xlsx, .xlsm, .xls)' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json(
        { detail: 'El archivo está vacío' },
        { status: 400 }
      )
    }

    // Parsear presupuestos del Excel
    let excelBudgets
    try {
      excelBudgets = parseExcelBudgets(buffer, 'Input Categories Budget')
    } catch (parseError: any) {
      return NextResponse.json(
        { detail: `Error al parsear presupuestos del Excel: ${parseError.message}` },
        { status: 400 }
      )
    }

    if (!excelBudgets || excelBudgets.length === 0) {
      return NextResponse.json(
        { 
          detail: 'No se encontraron presupuestos en el Excel. Verifica que la hoja "Input Categories Budget" tenga datos de presupuestos.',
          debug: 'El parser no encontró presupuestos válidos. Verifica que el Excel tenga la estructura correcta con columnas Type, Category, Subcategory y meses (JANUARY, FEBRUARY, etc.).'
        },
        { status: 400 }
      )
    }

    // Retornar los presupuestos parseados para que el usuario los seleccione
    return NextResponse.json({
      budgets: excelBudgets,
      total: excelBudgets.length,
      message: `Se encontraron ${excelBudgets.length} presupuestos en el Excel`,
    }, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/excel-import/parse-budgets:', error)
    return NextResponse.json(
      { detail: `Error al parsear presupuestos: ${error.message}` },
      { status: 500 }
    )
  }
}
