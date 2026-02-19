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

    // Obtener parámetros
    const { searchParams } = new URL(request.url)
    const skip = parseInt(searchParams.get('skip') || '0')
    const limit = parseInt(searchParams.get('limit') || '100')
    const status = searchParams.get('status')

    // Construir query
    let query = supabase
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    // Paginación
    query = query.range(skip, skip + limit - 1)

    const { data: receipts, error } = await query

    if (error) {
      console.error('Error obteniendo recibos:', error)
      return NextResponse.json(
        { detail: `Error al obtener recibos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(receipts || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/receipts:', error)
    return NextResponse.json(
      { detail: `Error al obtener recibos: ${error.message}` },
      { status: 500 }
    )
  }
}
