import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const budgetId = parseInt(id)

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
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()

    if (!userData?.is_family_admin) {
      return NextResponse.json(
        { detail: 'Solo el administrador puede distribuir presupuestos' },
        { status: 403 }
      )
    }

    // Verificar que el presupuesto exista
    const { data: familyBudget } = await supabase
      .from('family_budgets')
      .select('*')
      .eq('id', budgetId)
      .single()

    if (!familyBudget) {
      return NextResponse.json(
        { detail: 'Presupuesto no encontrado' },
        { status: 404 }
      )
    }

    if (familyBudget.family_id !== userData.family_id) {
      return NextResponse.json(
        { detail: 'No tienes acceso a este presupuesto' },
        { status: 403 }
      )
    }

    if (familyBudget.budget_type !== 'shared') {
      return NextResponse.json(
        { detail: 'Solo se pueden distribuir presupuestos compartidos' },
        { status: 400 }
      )
    }

    // Obtener miembros de la familia
    const { data: familyMembers } = await supabase
      .from('users')
      .select('id')
      .eq('family_id', userData.family_id)
      .eq('is_active', true)

    if (!familyMembers || familyMembers.length === 0) {
      return NextResponse.json(
        { detail: 'No hay miembros en la familia' },
        { status: 400 }
      )
    }

    // Eliminar asignaciones existentes
    await supabase
      .from('user_budgets')
      .delete()
      .eq('family_budget_id', budgetId)

    // Distribuir según el método
    if (familyBudget.distribution_method === 'equal') {
      const amountPerUser = familyBudget.total_amount / familyMembers.length
      const userBudgets = familyMembers.map((member: any) => ({
        user_id: member.id,
        family_budget_id: budgetId,
        allocated_amount: Math.round(amountPerUser * 100) / 100,
      }))

      const { error: insertError } = await supabase
        .from('user_budgets')
        .insert(userBudgets)

      if (insertError) {
        console.error('Error distribuyendo presupuesto:', insertError)
        return NextResponse.json(
          { detail: `Error al distribuir presupuesto: ${insertError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `Presupuesto distribuido entre ${familyMembers.length} miembros`,
        amount_per_user: Math.round((familyBudget.total_amount / familyMembers.length) * 100) / 100,
      }, { status: 200 })
    }

    return NextResponse.json(
      { detail: 'Método de distribución no soportado' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error en POST /api/budgets/family/[id]/distribute:', error)
    return NextResponse.json(
      { detail: `Error al distribuir presupuesto: ${error.message}` },
      { status: 500 }
    )
  }
}
