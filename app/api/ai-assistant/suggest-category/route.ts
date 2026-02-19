import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { suggestCategory } from '@/lib/services/ai-assistant'

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

    if (!body.description) {
      return NextResponse.json(
        { detail: 'La descripción es requerida' },
        { status: 400 }
      )
    }

    const amount = parseFloat(body.amount || 0)

    // Obtener categorías disponibles (usar enum del sistema)
    const availableCategories = [
      'SERVICIOS_BASICOS',
      'MERCADO',
      'VIVIENDA',
      'TRANSPORTE',
      'IMPUESTOS',
      'EDUCACION',
      'SALUD',
      'SALUD_MEDICAMENTOS',
      'VIDA_SOCIAL',
      'AGUINALDO_Y_VACACIONES',
    ]

    const suggestion = await suggestCategory(body.description, amount, availableCategories)

    if (!suggestion) {
      return NextResponse.json(
        { detail: 'No se pudo generar una sugerencia' },
        { status: 500 }
      )
    }

    return NextResponse.json(suggestion, { status: 200 })
  } catch (error: any) {
    console.error('Error en POST /api/ai-assistant/suggest-category:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
