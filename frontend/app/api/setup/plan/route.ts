import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSetupAdmin } from '../helpers'

export const dynamic = 'force-dynamic'

/**
 * GET: entidades, categorías y asignaciones actuales para el Paso 5.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  try {
    const supabase = await createClient()
    const [entitiesRes, categoriesRes, allocationsRes, familyRes] = await Promise.all([
      supabase.from('budget_entities').select('id, name, type, is_active').eq('family_id', auth.familyId).eq('is_active', true).order('name'),
      supabase.from('budget_categories').select('id, name, type, is_active').eq('family_id', auth.familyId).order('name'),
      supabase
        .from('entity_budget_allocations')
        .select('id, entity_id, category_id, monthly_limit, spent_amount, is_active')
        .eq('family_id', auth.familyId),
      supabase.from('families').select('plan_status').eq('id', auth.familyId).single(),
    ])

    if (entitiesRes.error) return NextResponse.json({ detail: entitiesRes.error.message }, { status: 500 })
    if (categoriesRes.error) return NextResponse.json({ detail: categoriesRes.error.message }, { status: 500 })
    if (allocationsRes.error) return NextResponse.json({ detail: allocationsRes.error.message }, { status: 500 })

    return NextResponse.json({
      entities: entitiesRes.data ?? [],
      categories: categoriesRes.data ?? [],
      allocations: allocationsRes.data ?? [],
      planStatus: (familyRes.data as { plan_status?: string } | null)?.plan_status ?? 'DRAFT',
    })
  } catch (e) {
    console.error('GET /api/setup/plan:', e)
    return NextResponse.json({ detail: 'Error al cargar plan' }, { status: 500 })
  }
}

/**
 * POST: guardar borrador (upsert asignaciones). Mantiene plan_status = DRAFT.
 *
 * Desactivación: NUNCA se elimina físicamente una fila de entity_budget_allocations.
 * Al desactivar una categoría para una entidad se hace UPDATE is_active = false.
 * Si la asignación tiene gastos relacionados (transacciones con budget_entity_id + budget_category_id),
 * el histórico (spent_amount) se mantiene en la misma fila; el trigger no depende de is_active.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const allocations = Array.isArray(body?.allocations) ? body.allocations : []

    const supabase = await createClient()

    for (const row of allocations) {
      const entityId = row?.entity_id
      const categoryId = row?.category_id
      const monthlyLimit = typeof row?.monthly_limit === 'number' ? Math.max(0, row.monthly_limit) : 0
      const isActive = typeof row?.is_active === 'boolean' ? row.is_active : true
      if (!entityId || !categoryId) continue

      // Solo upsert: nunca DELETE. Desactivar = is_active = false; la fila y spent_amount se conservan.
      const { error } = await supabase.from('entity_budget_allocations').upsert(
        {
          family_id: auth.familyId,
          entity_id: entityId,
          category_id: categoryId,
          monthly_limit: monthlyLimit,
          is_active: isActive,
        },
        { onConflict: 'family_id,entity_id,category_id' }
      )
      if (error) {
        return NextResponse.json({ detail: error.message }, { status: 500 })
      }
    }

    await supabase.from('families').update({ plan_status: 'DRAFT', updated_at: new Date().toISOString() }).eq('id', auth.familyId)

    return NextResponse.json({ ok: true, message: 'Borrador guardado' })
  } catch (e) {
    console.error('POST /api/setup/plan:', e)
    return NextResponse.json({ detail: 'Error al guardar borrador' }, { status: 500 })
  }
}
