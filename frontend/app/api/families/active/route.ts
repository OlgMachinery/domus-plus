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
      return NextResponse.json({ family: null }, { status: 200 })
    }

    const { data: family, error } = await supabase
      .from('families')
      .select('id, name')
      .eq('id', familyId)
      .single()

    if (error || !family) {
      return NextResponse.json({ family: null }, { status: 200 })
    }

    return NextResponse.json({ family: { id: family.id, name: family.name } }, { status: 200 })
  } catch (e) {
    console.error('families/active:', e)
    return NextResponse.json({ detail: 'Error' }, { status: 500 })
  }
}
