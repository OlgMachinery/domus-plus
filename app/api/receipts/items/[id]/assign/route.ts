import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const itemId = parseInt(id)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener item del recibo
    const { data: item } = await supabase
      .from('receipt_items')
      .select(`
        *,
        receipt:receipts(*)
      `)
      .eq('id', itemId)
      .single()

    if (!item) {
      return NextResponse.json(
        { detail: 'Item no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el recibo pertenezca al usuario
    if (item.receipt?.user_id !== authUser.id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este item' },
        { status: 403 }
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

    // Validar que se haya proporcionado family_budget_id
    if (!body.family_budget_id) {
      return NextResponse.json(
        { detail: 'Debes seleccionar una cuenta del presupuesto' },
        { status: 400 }
      )
    }

    // Verificar que el presupuesto exista y pertenezca a la familia
    const { data: familyBudget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', body.family_budget_id)
      .single()

    if (!familyBudget || familyBudget.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'Presupuesto no encontrado o no pertenece a tu familia' },
        { status: 404 }
      )
    }

    // Determinar usuarios a los que se asignará
    let usersToAssign: any[] = []
    if (body.assign_to_all || !body.target_user_id) {
      // Asignar a todos los usuarios de la familia
      const { data: familyUsers } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', userData.family_id)
        .eq('is_active', true)

      usersToAssign = familyUsers || []
    } else {
      // Asignar a un usuario específico
      const { data: targetUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', body.target_user_id)
        .eq('family_id', userData.family_id)
        .single()

      if (!targetUser) {
        return NextResponse.json(
          { detail: 'Usuario objetivo no encontrado o no pertenece a tu familia' },
          { status: 404 }
        )
      }
      usersToAssign = [targetUser]
    }

    // Actualizar item
    const { error: updateError } = await supabase
      .from('receipt_items')
      .update({
        family_budget_id: body.family_budget_id,
        assigned_to_user_id: body.target_user_id || null,
        assigned_to_all: body.assign_to_all || false,
      })
      .eq('id', itemId)

    if (updateError) {
      console.error('Error actualizando item:', updateError)
      return NextResponse.json(
        { detail: `Error al asignar item: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Crear transacciones si no se proporciona transaction_id
    if (!body.transaction_id && item.amount) {
      const transactions = usersToAssign.map((user: any) => ({
        user_id: user.id,
        family_budget_id: body.family_budget_id,
        date: item.receipt?.date || new Date().toISOString(),
        amount: item.amount / usersToAssign.length,
        transaction_type: 'expense',
        currency: item.receipt?.currency || 'MXN',
        merchant_or_beneficiary: item.receipt?.merchant_name || null,
        concept: item.name || 'Item de recibo asignado',
        reference: item.receipt?.reference || null,
        notes: `Asignado desde item de recibo #${itemId}`,
        status: 'processed',
      }))

      const { error: transError } = await supabase
        .from('transactions')
        .insert(transactions)

      if (transError) {
        console.error('Error creando transacciones:', transError)
        // No fallar, solo loggear
      }
    }

    return NextResponse.json(
      { message: 'Item asignado exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error en PUT /api/receipts/items/[id]/assign:', error)
    return NextResponse.json(
      { detail: `Error al asignar item: ${error.message}` },
      { status: 500 }
    )
  }
}
