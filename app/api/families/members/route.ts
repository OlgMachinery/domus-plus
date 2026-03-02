import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
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
      return NextResponse.json({ members: [] }, { status: 200 })
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, is_family_admin')
      .eq('family_id', familyId)
      .order('name')

    if (error) {
      console.error('Error obteniendo miembros:', error)
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    const members = (users || []).map((u) => ({
      id: u.id,
      name: u.name ?? undefined,
      isFamilyAdmin: u.is_family_admin ?? false,
    }))

    return NextResponse.json({ members }, { status: 200 })
  } catch (e) {
    console.error('families/members:', e)
    return NextResponse.json({ detail: 'Error' }, { status: 500 })
  }
}
