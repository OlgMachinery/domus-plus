import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSetupAdmin } from '../helpers'

export const dynamic = 'force-dynamic'

const ENTITY_TYPES = ['PERSON', 'VEHICLE', 'PROPERTY', 'GROUP'] as const

export async function GET(request: NextRequest) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('budget_entities')
      .select('id, name, type, is_active, owner_user_id, created_at')
      .eq('family_id', auth.familyId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('GET /api/setup/entities:', e)
    return NextResponse.json({ detail: 'Error al listar entidades' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const type = ENTITY_TYPES.includes(body?.type) ? body.type : null
    const isActive = typeof body?.is_active === 'boolean' ? body.is_active : true

    if (!name || !type) {
      return NextResponse.json(
        { detail: 'Nombre y tipo (PERSON, VEHICLE, PROPERTY, GROUP) son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('budget_entities')
      .insert({
        family_id: auth.familyId,
        name,
        type,
        is_active: isActive,
        owner_user_id: body?.owner_user_id || null,
      })
      .select('id, name, type, is_active, owner_user_id, created_at')
      .single()

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('POST /api/setup/entities:', e)
    return NextResponse.json({ detail: 'Error al crear entidad' }, { status: 500 })
  }
}
