import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener parámetros
    const formData = await request.formData()
    const file = formData.get('file') as File
    const sheetName = formData.get('sheet_name') as string | null
    const rows = parseInt(formData.get('rows') as string || '10')

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
        { detail: 'El archivo debe ser Excel (.xlsx, .xlsm, .xls)' },
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
    try {
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      
      // Si no se especifica hoja, usar la primera
      const targetSheetName = sheetName || workbook.SheetNames[0]
      
      if (!workbook.SheetNames.includes(targetSheetName)) {
        return NextResponse.json(
          {
            detail: `La hoja '${targetSheetName}' no existe. Hojas disponibles: ${workbook.SheetNames.join(', ')}`,
          },
          { status: 400 }
        )
      }
      
      const worksheet = workbook.Sheets[targetSheetName]
      const allData = XLSX.utils.sheet_to_json(worksheet, { defval: null })
      const previewData = allData.slice(0, rows)
      
      return NextResponse.json({
        filename: file.name,
        sheet_name: targetSheetName,
        total_rows_in_sheet: allData.length,
        preview_rows: rows,
        columns: previewData.length > 0 ? Object.keys(previewData[0]) : [],
        data: previewData,
      }, { status: 200 })
    } catch (excelError: any) {
      // Si xlsx no está instalado, retornar error
      if (excelError.code === 'MODULE_NOT_FOUND') {
        return NextResponse.json(
          { 
            detail: 'Procesamiento de Excel requiere dependencias adicionales. Instala: npm install xlsx',
            filename: file.name,
            size: buffer.length,
          },
          { status: 501 }
        )
      }
      throw excelError
    }
  } catch (error: any) {
    console.error('Error en POST /api/excel/preview:', error)
    return NextResponse.json(
      { detail: `Error al procesar el archivo: ${error.message}` },
      { status: 500 }
    )
  }
}
