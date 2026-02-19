import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const getAuthUser = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: NextRequest
) => {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null
  if (token) {
    const result = await supabase.auth.getUser(token)
    if (!result.error && result.data.user) return result
  }
  return supabase.auth.getUser()
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const transactionId = parseInt(params.id)

    // Verificar autenticaci?n
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', authUser.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { detail: 'Transacci?n no encontrada' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { detail: `Error al obtener transacci?n: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(transaction, { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/transactions/[id]:', error)
    return NextResponse.json(
      { detail: `Error al obtener transacci?n: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient(request)
    const transactionId = parseInt(params.id)
    const updates = await request.json()

    // Verificar autenticaci?n
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { detail: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor' },
        { status: 500 }
      )
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Obtener transacci?n actual
    const { data: currentTransaction, error: getError } = await admin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (getError || !currentTransaction) {
      return NextResponse.json(
        { detail: 'Transacci?n no encontrada' },
        { status: 404 }
      )
    }

    if (currentTransaction.user_id !== authUser.id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a esta transacci?n' },
        { status: 403 }
      )
    }

    // Validar y preparar actualizaciones
    const updateData: any = {}

    if ('amount' in updates) {
      const newAmount = parseFloat(updates.amount)
      if (newAmount <= 0) {
        return NextResponse.json(
          { detail: 'El monto debe ser mayor a cero' },
          { status: 400 }
        )
      }
      if (newAmount > 1000000000) {
        return NextResponse.json(
          { detail: 'El monto excede el l?mite permitido' },
          { status: 400 }
        )
      }
      updateData.amount = newAmount
    }

    if ('date' in updates) {
      updateData.date = updates.date
    }

    if ('concept' in updates) {
      updateData.concept = updates.concept
    }

    if ('family_budget_id' in updates) {
      const newBudgetId = updates.family_budget_id
      if (newBudgetId) {
        // Verificar que el presupuesto pertenezca a la familia
        const { data: budgetData } = await admin
          .from('family_budgets')
          .select('family_id')
          .eq('id', newBudgetId)
          .single()

        if (budgetData) {
          const { data: userData } = await admin
            .from('users')
            .select('family_id')
            .eq('id', authUser.id)
            .single()

          if (userData?.family_id !== budgetData.family_id) {
            return NextResponse.json(
              { detail: 'No tienes acceso a este presupuesto' },
              { status: 403 }
            )
          }
        }
      }
      updateData.family_budget_id = newBudgetId
    }

    // Actualizar transacci?n
    const { data: updatedTransaction, error: updateError } = await admin
      .from('transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error actualizando transacci?n:', updateError)
      return NextResponse.json(
        { detail: `Error al actualizar transacci?n: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Crear log de actividad
    try {
      await admin.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'transaction_updated',
        entity_type: 'transaction',
        description: `Transacci?n actualizada: ${updatedTransaction.transaction_type} de $${updatedTransaction.amount}`,
        entity_id: updatedTransaction.id,
        details: updates,
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
    }

    return NextResponse.json(updatedTransaction, { status: 200 })
  } catch (error: any) {
    console.error('Error en PUT /api/transactions/[id]:', error)
    return NextResponse.json(
      { detail: `Error al actualizar transacci?n: ${error.message}` },
      { status: 500 }
    )
  }
}
