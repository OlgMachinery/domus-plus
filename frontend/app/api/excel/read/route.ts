import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación (múltiples métodos)
    const supabase = await createClient(request)
    let authUser = null
    
    // Método 1: Token en header Authorization
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    
    if (accessToken) {
      const { data: { user }, error: tokenError } = await supabase.auth.getUser(accessToken)
      if (user && !tokenError) {
        authUser = user
      }
    }
    
    // Método 2: Cookies (fallback)
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

    // Obtener archivo del form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { detail: 'No se proporcionó un archivo' },
        { status: 400 }
      )
    }

    // Validar extensión
    const validExtensions = ['.xlsx', '.xlsm', '.xls']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))

    if (!hasValidExtension) {
      return NextResponse.json(
        { detail: `El archivo debe ser Excel (.xlsx, .xlsm, .xls). Recibido: ${file.name}` },
        { status: 400 }
      )
    }

    // Leer el archivo
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length === 0) {
      return NextResponse.json(
        { detail: 'El archivo está vacío' },
        { status: 400 }
      )
    }

    // Procesar Excel usando xlsx
    let XLSX: any
    try {
      XLSX = require('xlsx')
    } catch (requireError: any) {
      if (requireError.code === 'MODULE_NOT_FOUND') {
        return NextResponse.json(
          { 
            detail: 'Procesamiento de Excel requiere la dependencia xlsx. Por favor, ejecuta: cd frontend && npm install xlsx',
            error_code: 'MODULE_NOT_FOUND',
          },
          { status: 500 }
        )
      }
      throw requireError
    }

    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      
      const result: any = {
        filename: file.name,
        sheets: [],
        total_sheets: workbook.SheetNames.length,
      }
      
      for (const sheetName of workbook.SheetNames) {
        try {
          const worksheet = workbook.Sheets[sheetName]
          const data = XLSX.utils.sheet_to_json(worksheet, { defval: null })
          
          // Obtener información de la hoja
          const sheetInfo: any = {
            name: sheetName,
            rows: data.length,
            columns: data.length > 0 ? Object.keys(data[0]).length : 0,
            column_names: data.length > 0 ? Object.keys(data[0]) : [],
            data: data.slice(0, 100), // Primeras 100 filas
          }
          
          // Estadísticas para columnas numéricas
          if (data.length > 0) {
            const numericCols: string[] = []
            const firstRow = data[0]
            for (const key in firstRow) {
              const val = firstRow[key]
              if (typeof val === 'number') {
                numericCols.push(key)
              }
            }
            
            if (numericCols.length > 0) {
              const stats: Record<string, any> = {}
              for (const col of numericCols) {
                const values = data.map((row: any) => row[col]).filter((v: any) => typeof v === 'number')
                if (values.length > 0) {
                  const sum = values.reduce((a: number, b: number) => a + b, 0)
                  const avg = sum / values.length
                  const min = Math.min(...values)
                  const max = Math.max(...values)
                  stats[col] = { count: values.length, sum, mean: avg, min, max }
                }
              }
              sheetInfo.statistics = stats
            }
          }
          
          result.sheets.push(sheetInfo)
        } catch (sheetError: any) {
          result.sheets.push({
            name: sheetName,
            error: `Error al leer la hoja: ${sheetError.message}`,
          })
        }
      }
      
      return NextResponse.json(result, { status: 200 })
    } catch (excelError: any) {
      console.error('Error procesando Excel:', excelError)
      // Si xlsx no está instalado, retornar error
      if (excelError.code === 'MODULE_NOT_FOUND' || excelError.message?.includes('Cannot find module') || excelError.message?.includes('xlsx')) {
        return NextResponse.json(
          { 
            detail: 'Procesamiento de Excel requiere la dependencia xlsx. Por favor, ejecuta: cd frontend && npm install xlsx && reinicia el servidor',
            error_code: 'MODULE_NOT_FOUND',
            filename: file.name,
            size: buffer.length,
          },
          { status: 500 }
        )
      }
      // Otros errores de procesamiento
      return NextResponse.json(
        { 
          detail: `Error al procesar el archivo Excel: ${excelError.message || 'Error desconocido'}`,
          error_code: 'EXCEL_PROCESSING_ERROR',
          filename: file.name,
          stack: process.env.NODE_ENV === 'development' ? excelError.stack : undefined,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error en POST /api/excel/read:', error)
    return NextResponse.json(
      { 
        detail: `Error al procesar el archivo Excel: ${error.message || 'Error desconocido'}`,
        error_code: 'UNKNOWN_ERROR',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
