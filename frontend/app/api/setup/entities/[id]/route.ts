import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSetupAdmin } from '../../helpers'

export const dynamic = 'force-dynamic'

const ENTITY_TYPES = ['PERSON', 'VEHICLE', 'PROPERTY', 'GROUP'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    if (typeof body?.name === 'string' && body.name.trim()) updates.name = body.name.trim()
    if (ENTITY_TYPES.includes(body?.type)) updates.type = body.type
    if (typeof body?.is_active === 'boolean') updates.is_active = body.is_active
    if (body?.owner_user_id !== undefined) updates.owner_user_id = body.owner_user_id || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ detail: 'Nada que actualizar' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('budget_entities')
      .update(updates)
      .eq('id', id)
      .eq('family_id', auth.familyId)
      .select('id, name, type, is_active, owner_user_id, created_at')
      .single()

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ detail: 'Entidad no encontrada' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('PATCH /api/setup/entities/[id]:', e)
    return NextResponse.json({ detail: 'Error al actualizar entidad' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  const { id } = await params
  try {
    const supabase = await createClient()
    const { data: allocations } = await supabase
      .from('entity_budget_allocations')
      .select('id')
      .eq('entity_id', id)
      .eq('family_id', auth.familyId)

    if (allocations?.length) {
      return NextResponse.json(
        { detail: 'No se puede eliminar: tiene asignaciones. Desactiva la entidad en su lugar.' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('budget_entities')
      .delete()
      .eq('id', id)
      .eq('family_id', auth.familyId)

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('DELETE /api/setup/entities/[id]:', e)
    return NextResponse.json({ detail: 'Error al eliminar entidad' }, { status: 500 })
  }
}
