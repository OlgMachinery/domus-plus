import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient(request)

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ detail: 'No autenticado' }, { status: 401 })
    }

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0]

    // Usuario con nombre (public.users)
    const { data: profile } = await supabase
      .from('users')
      .select('name, family_id')
      .eq('id', authUser.id)
      .single()

    // Presupuesto del mes: suma de total_amount de family_budgets del año / 12 (si tiene familia)
    let totalBudgetMonth = 0
    if (profile?.family_id) {
      const { data: budgets } = await supabase
        .from('family_budgets')
        .select('total_amount')
        .eq('family_id', profile.family_id)
        .eq('year', year)
      const yearTotal = (budgets || []).reduce((s, b) => s + (Number(b.total_amount) || 0), 0)
      totalBudgetMonth = yearTotal / 12
    }

    // Gastado este mes (expenses del usuario en el mes actual)
    const { data: txMonth } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', authUser.id)
      .eq('transaction_type', 'expense')
      .gte('date', firstDay)
      .lte('date', lastDay)
    const spentMonth = (txMonth || []).reduce((s, t) => s + (Number(t.amount) || 0), 0)

    const remainingMonth = Math.max(0, totalBudgetMonth - spentMonth)

    // Recibos pendientes de revisión
    const { data: allReceipts } = await supabase
      .from('receipts')
      .select('id, status')
      .eq('user_id', authUser.id)
    const pendingCount = (allReceipts || []).filter(
      (r: { status?: string }) => !r.status || r.status === 'pending' || r.status === 'uploaded' || r.status !== 'processed'
    ).length

    // Transacciones recientes (últimas 10)
    const { data: recentTx } = await supabase
      .from('transactions')
      .select('id, date, amount, transaction_type, merchant_or_beneficiary, category, concept')
      .eq('user_id', authUser.id)
      .order('date', { ascending: false })
      .limit(10)

    return NextResponse.json({
      name: profile?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuario',
      totalBudgetMonth: Math.round(totalBudgetMonth * 100) / 100,
      spentMonth: Math.round(spentMonth * 100) / 100,
      remainingMonth: Math.round(remainingMonth * 100) / 100,
      receiptsPending: pendingCount,
      recentTransactions: recentTx || [],
    })
  } catch (error: any) {
    console.error('Error en GET /api/dashboard/stats:', error)
    return NextResponse.json(
      { detail: error?.message || 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
