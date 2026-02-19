import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const receiptId = parseInt(params.id)

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: receipt, error } = await supabase
      .from('receipts')
      .select(`
        *,
        items:receipt_items(*)
      `)
      .eq('id', receiptId)
      .eq('user_id', authUser.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Recibo no encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener recibo: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(receipt, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/receipts/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener recibo: ${error.message}` },
      { status: 500 }
    )
  }
}
