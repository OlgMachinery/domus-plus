import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    // Este endpoint es para desarrollo/testing
    return NextResponse.json(
      { 
        message: 'Endpoint de desarrollo. Implementar según necesidad.',
        note: 'Ver backend/app/routers/dev.py para la implementación completa.'
      },
      { status: 501 } // Not Implemented
    )
  } catch (error: any) {
    console.error('Error en POST /api/dev/delete-all-transactions:', error)
    return NextResponse.json(
      { detail: `Error: ${error.message}` },
      { status: 500 }
    )
  }
}
