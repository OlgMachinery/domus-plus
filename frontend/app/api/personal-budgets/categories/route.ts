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

    // Categorías individuales predefinidas
    const categories = [
      {
        category: 'FOOD',
        subcategories: ['GROCERIES', 'RESTAURANTS', 'FAST_FOOD', 'COFFEE', 'ALCOHOL']
      },
      {
        category: 'TRANSPORTATION',
        subcategories: ['GAS', 'PUBLIC_TRANSPORT', 'TAXI', 'PARKING', 'MAINTENANCE']
      },
      {
        category: 'ENTERTAINMENT',
        subcategories: ['MOVIES', 'CONCERTS', 'SPORTS', 'GAMES', 'STREAMING']
      },
      {
        category: 'SHOPPING',
        subcategories: ['CLOTHING', 'ELECTRONICS', 'BOOKS', 'HOME', 'PERSONAL_CARE']
      },
      {
        category: 'HEALTH',
        subcategories: ['DOCTOR', 'PHARMACY', 'GYM', 'INSURANCE', 'SUPPLEMENTS']
      },
      {
        category: 'EDUCATION',
        subcategories: ['TUITION', 'BOOKS', 'COURSES', 'SUPPLIES', 'CERTIFICATIONS']
      },
      {
        category: 'PERSONAL',
        subcategories: ['HAIR', 'NAILS', 'SPA', 'GIFTS', 'DONATIONS']
      },
      {
        category: 'TRAVEL',
        subcategories: ['FLIGHTS', 'HOTELS', 'FOOD', 'ACTIVITIES', 'SHOPPING']
      }
    ]

    return NextResponse.json(categories, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/personal-budgets/categories:', error)
    return NextResponse.json(
      { detail: `Error al obtener categorías: ${error.message}` },
      { status: 500 }
    )
  }
}
