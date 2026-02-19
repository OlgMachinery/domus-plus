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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    
    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const transaction_type = searchParams.get('transaction_type')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Construir query
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', authUser.id)
      .order('date', { ascending: false })

    // Aplicar filtros
    if (category) {
      query = query.eq('category', category)
    }
    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type)
    }
    if (start_date) {
      query = query.gte('date', start_date)
    }
    if (end_date) {
      query = query.lte('date', end_date)
    }

    // Paginación
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      console.error('Error obteniendo transacciones:', error)
      return NextResponse.json(
        { detail: `Error al obtener transacciones: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(data || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/transactions:', error)
    return NextResponse.json(
      { detail: `Error al obtener transacciones: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient(request)
    const body = await request.json()

    // Verificar autenticación
    const { data: { user: authUser }, error: authError } = await getAuthUser(supabase, request)
    if (authError || !authUser) {
      return NextResponse.json(
        { detail: 'No autenticado' },
        { status: 401 }
      )
    }

    // Validaciones
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { detail: 'El monto debe ser mayor a cero' },
        { status: 400 }
      )
    }

    if (body.amount > 1000000000) {
      return NextResponse.json(
        { detail: 'El monto excede el límite permitido' },
        { status: 400 }
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

    // Verificar que el presupuesto pertenezca a la familia si se proporciona
    if (body.family_budget_id) {
      const { data: budgetData } = await admin
        .from('family_budgets')
        .select('family_id')
        .eq('id', body.family_budget_id)
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

    // Crear transacción
    const transactionData = {
      user_id: authUser.id,
      family_budget_id: body.family_budget_id || null,
      date: body.date || new Date().toISOString(),
      amount: body.amount,
      transaction_type: body.transaction_type || 'expense',
      currency: body.currency || 'MXN',
      merchant_or_beneficiary: body.merchant_or_beneficiary || null,
      category: body.category || null,
      subcategory: body.subcategory || null,
      custom_category_id: body.custom_category_id || null,
      custom_subcategory_id: body.custom_subcategory_id || null,
      concept: body.concept || null,
      reference: body.reference || null,
      operation_id: body.operation_id || null,
      tracking_key: body.tracking_key || null,
      notes: body.notes || null,
      status: 'processed',
    }

    const { data: transaction, error: transactionError } = await admin
      .from('transactions')
      .insert(transactionData)
      .select()
      .single()

    if (transactionError) {
      console.error('Error creando transacción:', transactionError)
      return NextResponse.json(
        { detail: `Error al crear transacción: ${transactionError.message}` },
        { status: 500 }
      )
    }

    // Crear log de actividad
    try {
      await admin.from('activity_logs').insert({
        user_id: authUser.id,
        action_type: 'transaction_created',
        entity_type: 'transaction',
        description: `Transacción creada: ${body.transaction_type} de $${body.amount}`,
        entity_id: transaction.id,
        details: {
          transaction_type: body.transaction_type,
          amount: body.amount,
          category: body.category,
        },
      })
    } catch (logError) {
      console.error('Error creando log:', logError)
      // No fallar si el log falla
    }

    return NextResponse.json(transaction, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/transactions:', error)
    return NextResponse.json(
      { detail: `Error al crear transacción: ${error.message}` },
      { status: 500 }
    )
  }
}
