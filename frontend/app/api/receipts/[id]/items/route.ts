import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const receiptId = parseInt(params.id)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar que el recibo exista y pertenezca al usuario
    const { data: receipt } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('user_id', authUser.id)
      .single()

    if (!receipt) {
      return NextResponse.json(
        { detail: 'Recibo no encontrado' },
        { status: 404 }
      )
    }

    // Validaciones
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { detail: 'El nombre del item es requerido' },
        { status: 400 }
      )
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { detail: 'El monto debe ser mayor a cero' },
        { status: 400 }
      )
    }

    // Crear item del recibo
    const { data: item, error: itemError } = await supabase
      .from('receipt_items')
      .insert({
        receipt_id: receiptId,
        name: body.name.trim(),
        description: body.description || null,
        quantity: body.quantity || 1,
        unit_price: body.unit_price || body.amount,
        amount: body.amount,
        category: body.category || null,
        subcategory: body.subcategory || null,
        custom_category_id: body.custom_category_id || null,
        custom_subcategory_id: body.custom_subcategory_id || null,
      })
      .select()
      .single()

    if (itemError) {
      console.error('Error creando item:', itemError)
      return NextResponse.json(
        { detail: `Error al crear item: ${itemError.message}` },
        { status: 500 }
      )
    }

    // Actualizar total del recibo si es necesario
    const { data: allItems } = await supabase
      .from('receipt_items')
      .select('amount')
      .eq('receipt_id', receiptId)

    const newTotal = allItems?.reduce((sum, i) => sum + (i.amount || 0), 0) || 0

    await supabase
      .from('receipts')
      .update({ total_amount: newTotal })
      .eq('id', receiptId)

    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/receipts/[id]/items:', error)
    return NextResponse.json(
      { detail: `Error al crear item: ${error.message}` },
      { status: 500 }
    )
  }
}
