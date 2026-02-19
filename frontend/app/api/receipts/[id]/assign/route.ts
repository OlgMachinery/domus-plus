import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
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

    // Obtener usuario completo
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

    // Obtener recibo
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

    // Actualizar recibo
    const { error: updateError } = await supabase
      .from('receipts')
      .update({
        family_budget_id: body.family_budget_id,
        status: 'assigned',
      })
      .eq('id', receiptId)

    if (updateError) {
      console.error('Error actualizando recibo:', updateError)
      return NextResponse.json(
        { detail: `Error al asignar recibo: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Crear transacciones si no se proporciona transaction_id
    if (!body.transaction_id && receipt.total_amount) {
      const transactions = usersToAssign.map((user: any) => ({
        user_id: user.id,
        family_budget_id: body.family_budget_id,
        date: receipt.date || new Date().toISOString(),
        amount: receipt.total_amount / usersToAssign.length,
        transaction_type: 'expense',
        currency: receipt.currency || 'MXN',
        merchant_or_beneficiary: receipt.merchant_name || null,
        concept: receipt.concept || 'Recibo asignado',
        reference: receipt.reference || null,
        notes: `Asignado desde recibo #${receiptId}`,
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
      { message: 'Recibo asignado exitosamente' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error en POST /api/receipts/[id]/assign:', error)
    return NextResponse.json(
      { detail: `Error al asignar recibo: ${error.message}` },
      { status: 500 }
    )
  }
}
