import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface BudgetSummaryCategory {
  category_id: string
  category_name: string
  monthly_limit: number
  spent_amount: number
  remaining: number
}

interface BudgetSummaryEntity {
  entity_id: string
  entity_name: string
  total_limit: number
  total_spent: number
  remaining: number
  categories: BudgetSummaryCategory[]
}

interface BudgetSummaryResponse {
  global: { limit: number; spent: number; remaining: number }
  entities: BudgetSummaryEntity[]
}

const emptyResponse: BudgetSummaryResponse = {
  global: { limit: 0, spent: 0, remaining: 0 },
  entities: [],
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ detail: 'No autenticado' }, { status: 401 })
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('family_id')
      .eq('id', authUser.id)
      .single()

    const familyId = userRow?.family_id
    if (familyId == null) {
      return NextResponse.json(emptyResponse, { status: 200 })
    }

    const { data: allocations, error: allocError } = await supabase
      .from('entity_budget_allocations')
      .select(
        `
        entity_id,
        category_id,
        monthly_limit,
        spent_amount,
        budget_entities!inner(id, name),
        budget_categories!inner(id, name)
      `
      )
      .eq('family_id', familyId)
      .eq('is_active', true)

    if (allocError) {
      console.error('GET /api/budget/summary allocations:', allocError)
      return NextResponse.json(
        { detail: `Error al obtener resumen: ${allocError.message}` },
        { status: 500 }
      )
    }

    if (!allocations?.length) {
      return NextResponse.json(emptyResponse, { status: 200 })
    }

    type Row = {
      entity_id: string
      category_id: string
      monthly_limit: number
      spent_amount: number
      budget_entities: { id: string; name: string } | null
      budget_categories: { id: string; name: string } | null
    }

    const rows = allocations as unknown as Row[]
    const entityMap = new Map<
      string,
      {
        entity_name: string
        total_limit: number
        total_spent: number
        categories: BudgetSummaryCategory[]
      }
    >()

    let globalLimit = 0
    let globalSpent = 0

    for (const r of rows) {
      const limit = Number(r.monthly_limit) || 0
      const spent = Number(r.spent_amount) || 0
      globalLimit += limit
      globalSpent += spent

      const entityId = r.entity_id
      const entityName = r.budget_entities?.name ?? 'Sin nombre'
      const catName = r.budget_categories?.name ?? 'Sin nombre'

      const cat: BudgetSummaryCategory = {
        category_id: r.category_id,
        category_name: catName,
        monthly_limit: limit,
        spent_amount: spent,
        remaining: Math.max(0, limit - spent),
      }

      if (!entityMap.has(entityId)) {
        entityMap.set(entityId, {
          entity_name: entityName,
          total_limit: 0,
          total_spent: 0,
          categories: [],
        })
      }
      const ent = entityMap.get(entityId)!
      ent.total_limit += limit
      ent.total_spent += spent
      ent.categories.push(cat)
    }

    const entities: BudgetSummaryEntity[] = Array.from(entityMap.entries()).map(
      ([entity_id, e]) => ({
        entity_id,
        entity_name: e.entity_name,
        total_limit: e.total_limit,
        total_spent: e.total_spent,
        remaining: Math.max(0, e.total_limit - e.total_spent),
        categories: e.categories,
      })
    )

    const response: BudgetSummaryResponse = {
      global: {
        limit: globalLimit,
        spent: globalSpent,
        remaining: Math.max(0, globalLimit - globalSpent),
      },
      entities,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error: unknown) {
    console.error('GET /api/budget/summary:', error)
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : 'Error al obtener resumen de presupuesto',
      },
      { status: 500 }
    )
  }
}
