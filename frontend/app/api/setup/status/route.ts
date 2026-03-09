import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/setup/status
 * Devuelve estado del setup para gate e indicador visual.
 * No modifica comportamiento de transacciones ni dashboard.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ detail: 'No autenticado' }, { status: 401 })
    }

    let userRow: { family_id: number | null; is_family_admin: boolean } | null = null
    const { data: row } = await supabase
      .from('users')
      .select('family_id, is_family_admin')
      .eq('id', authUser.id)
      .single()
    if (row) userRow = { family_id: row.family_id ?? null, is_family_admin: row.is_family_admin ?? false }
    if (!userRow && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: adminRow } = await admin.from('users').select('family_id, is_family_admin').eq('id', authUser.id).single()
      if (adminRow) userRow = { family_id: adminRow.family_id ?? null, is_family_admin: adminRow.is_family_admin ?? false }
    }

    const familyIdRaw = userRow?.family_id ?? null
    const familyId = familyIdRaw != null ? Number(familyIdRaw) : null
    const isAdmin = userRow?.is_family_admin ?? false

    if (familyId == null || !Number.isInteger(familyId) || familyId < 1) {
      return NextResponse.json({
        hasFamily: false,
        setupComplete: false,
        planStatus: null,
        currentStep: 1,
        familyId: null,
        isAdmin,
      })
    }

    const { data: family } = await supabase
      .from('families')
      .select('setup_complete, plan_status')
      .eq('id', familyId)
      .single()

    const setupComplete = family?.setup_complete === true
    const planStatus = family?.plan_status ?? 'DRAFT'

    // Misma lógica que can_set_setup_complete: ≥1 PERSON activa, ≥1 GROUP activa, ≥1 categoría activa, ≥1 asignación con monto > 0
    const { data: personRows } = await supabase
      .from('budget_entities')
      .select('id')
      .eq('family_id', familyId)
      .eq('type', 'PERSON')
      .eq('is_active', true)
    const hasPersonActive = Array.isArray(personRows) && personRows.length > 0

    const { data: groupRows } = await supabase
      .from('budget_entities')
      .select('id')
      .eq('family_id', familyId)
      .eq('type', 'GROUP')
      .eq('is_active', true)
    const hasGroupActive = Array.isArray(groupRows) && groupRows.length > 0

    const { data: categoryRows } = await supabase
      .from('budget_categories')
      .select('id')
      .eq('family_id', familyId)
      .eq('is_active', true)
    const hasCategoryActive = Array.isArray(categoryRows) && categoryRows.length > 0

    const { data: allocationRows } = await supabase
      .from('entity_budget_allocations')
      .select('id')
      .eq('family_id', familyId)
      .eq('is_active', true)
      .gt('monthly_limit', 0)
    const hasAllocationPositive = Array.isArray(allocationRows) && allocationRows.length > 0

    let currentStep = 1
    if (setupComplete) {
      currentStep = 6 // "completo"
    } else {
      if (!hasPersonActive || !hasGroupActive) currentStep = 3 // entidades (misma lógica que can_set_setup_complete)
      else if (!hasCategoryActive) currentStep = 4
      else if (!hasAllocationPositive) currentStep = 5
      else currentStep = 5 // listo para confirmar
    }

    return NextResponse.json({
      hasFamily: true,
      setupComplete,
      planStatus,
      currentStep,
      familyId,
      isAdmin,
    })
  } catch (e) {
    console.error('GET /api/setup/status:', e)
    return NextResponse.json({ detail: 'Error al obtener estado' }, { status: 500 })
  }
}
