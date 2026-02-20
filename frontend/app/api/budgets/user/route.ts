import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    const { data: budgets, error } = await supabase
      .from('user_budgets')
      .select(`
        *,
        family_budget:family_budgets(*),
        user:users(id, name, email)
      `)
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo presupuestos de usuario:', error)
      return NextResponse.json(
        { detail: `Error al obtener presupuestos: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(budgets || [], { status: 200 })
  } catch (error: any) {
    console.error('Error en GET /api/budgets/user:', error)
    return NextResponse.json(
      { detail: `Error al obtener presupuestos: ${error.message}` },
      { status: 500 }
    )
  }
}

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

    // Validaciones
    if (!body.family_budget_id) {
      return NextResponse.json(
        { detail: 'family_budget_id es requerido' },
        { status: 400 }
      )
    }

    if (!body.allocated_amount || body.allocated_amount <= 0) {
      return NextResponse.json(
        { detail: 'El monto asignado debe ser mayor a cero' },
        { status: 400 }
      )
    }

    if (body.allocated_amount > 1000000000) {
      return NextResponse.json(
        { detail: 'El monto asignado excede el límite permitido' },
        { status: 400 }
      )
    }

    // Verificar que el presupuesto familiar exista y pertenezca a la familia
    const { data: familyBudget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', body.family_budget_id)
      .single()

    if (!familyBudget) {
      return NextResponse.json(
        { detail: 'Presupuesto familiar no encontrado' },
        { status: 404 }
      )
    }

    if (familyBudget.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este presupuesto' },
        { status: 403 }
      )
    }

    // Verificar que el user_id pertenezca a la misma familia
    const targetUserId = body.user_id || authUser.id
    const { data: targetUser } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', targetUserId)
      .single()

    if (!targetUser || targetUser.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'El usuario debe pertenecer a la misma familia' },
        { status: 403 }
      )
    }

    // Verificar que no exceda el total del presupuesto familiar
    const { data: existingAllocations } = await supabase
      .from('user_budgets')
      .select('allocated_amount')
      .eq('family_budget_id', body.family_budget_id)

    const totalAllocated = existingAllocations?.reduce(
      (sum, alloc) => sum + (alloc.allocated_amount || 0),
      0
    ) || 0

    if (totalAllocated + body.allocated_amount > familyBudget.total_amount) {
      const available = familyBudget.total_amount - totalAllocated
      return NextResponse.json(
        { detail: `La asignación excede el presupuesto familiar disponible. Disponible: $${available.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Crear presupuesto de usuario
    const { data: userBudget, error: budgetError } = await supabase
      .from('user_budgets')
      .insert({
        user_id: targetUserId,
        family_budget_id: body.family_budget_id,
        allocated_amount: body.allocated_amount,
      })
      .select()
      .single()

    if (budgetError) {
      console.error('Error creando presupuesto de usuario:', budgetError)
      return NextResponse.json(
        { detail: `Error al crear presupuesto: ${budgetError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(userBudget, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/budgets/user:', error)
    return NextResponse.json(
      { detail: `Error al crear presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
