import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function toInt(value: string | null, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.trunc(n)
}

function safeIsoFromDateOnly(s: string, endOfDay = false) {
  // s = YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return endOfDay ? `${s}T23:59:59.999Z` : `${s}T00:00:00.000Z`
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ detail: 'No autenticado' }, { status: 401 })
    }

    const { data: me, error: meError } = await supabase.from('users').select('id, family_id, is_family_admin').eq('id', authUser.id).single()
    if (meError || !me?.id) return NextResponse.json({ detail: 'No se pudo obtener el usuario' }, { status: 500 })
    if (!me.family_id) return NextResponse.json({ ok: true, transactions: [] }, { status: 200 })

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      // Fallback (RLS): al menos devolvemos las propias transacciones.
      const { data: own } = await supabase.from('transactions').select('*').eq('user_id', authUser.id).order('date', { ascending: false })
      return NextResponse.json({ ok: true, scope: 'user', transactions: own || [] }, { status: 200 })
    }

    const sp = req.nextUrl.searchParams
    const limit = Math.max(1, Math.min(2000, toInt(sp.get('limit'), 500)))
    const offset = Math.max(0, toInt(sp.get('offset'), 0))

    const transactionType = sp.get('transaction_type')
    const category = sp.get('category')
    const subcategory = sp.get('subcategory')
    const startDate = sp.get('start_date')
    const endDate = sp.get('end_date')
    const amountMin = sp.get('amount_min')
    const amountMax = sp.get('amount_max')
    const merchant = sp.get('merchant')
    const userId = sp.get('user_id')

    const startIso = startDate ? safeIsoFromDateOnly(startDate, false) : null
    const endIso = endDate ? safeIsoFromDateOnly(endDate, true) : null

    const admin = createAdminClient()

    let query = admin
      .from('transactions')
      .select(
        `
        *,
        user:users!inner(id, name, email, family_id),
        budget:family_budgets(id, category, subcategory, year, budget_type, target_user_id)
      `
      )
      .eq('user.family_id', me.family_id)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (transactionType && (transactionType === 'income' || transactionType === 'expense')) {
      query = query.eq('transaction_type', transactionType)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (subcategory) {
      query = query.eq('subcategory', subcategory)
    }
    if (startIso) {
      query = query.gte('date', startIso)
    }
    if (endIso) {
      query = query.lte('date', endIso)
    }
    if (amountMin) {
      const n = Number(amountMin)
      if (Number.isFinite(n)) query = query.gte('amount', n)
    }
    if (amountMax) {
      const n = Number(amountMax)
      if (Number.isFinite(n)) query = query.lte('amount', n)
    }
    if (merchant && merchant.trim()) {
      const q = merchant.trim().replace(/%/g, '')
      // Busca en merchant y concepto
      query = query.or(`merchant_or_beneficiary.ilike.%${q}%,concept.ilike.%${q}%`)
    }

    const { data: txs, error } = await query
    if (error) {
      return NextResponse.json({ detail: error.message || 'Error cargando transacciones' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, scope: 'family', transactions: txs || [] }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Error interno' }, { status: 500 })
  }
}

