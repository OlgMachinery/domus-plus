import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSetupAdmin } from '../../helpers'

export const dynamic = 'force-dynamic'

/**
 * POST: confirmar plan. Valida con can_set_setup_complete; si ok, plan_status = CONFIRMED y setup_complete = true.
 * No activa el switch (Fase 2).
 */
export async function POST(request: NextRequest) {
  const auth = await requireSetupAdmin(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  try {
    const supabase = await createClient()

    const { data: familyRow } = await supabase
      .from('families')
      .select('plan_status')
      .eq('id', auth.familyId)
      .single()

    if ((familyRow as { plan_status?: string } | null)?.plan_status === 'CONFIRMED') {
      return NextResponse.json({ ok: true, message: 'El plan ya estaba confirmado.', setupComplete: true })
    }

    await supabase.from('families').update({ plan_status: 'CONFIRMED', updated_at: new Date().toISOString() }).eq('id', auth.familyId)

    const { data: checkRows, error: checkError } = await supabase.rpc('can_set_setup_complete', {
      p_family_id: auth.familyId,
    })

    if (checkError) {
      return NextResponse.json(
        { detail: checkError.message || 'Error al validar condiciones' },
        { status: 500 }
      )
    }

    const result = Array.isArray(checkRows) ? checkRows[0] : checkRows
    const ok = (result as { ok?: boolean })?.ok === true
    const reason = (result as { reason?: string })?.reason

    if (!ok) {
      return NextResponse.json(
        { detail: reason || 'No se cumplen las condiciones para marcar setup completo.' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('families')
      .update({
        plan_status: 'CONFIRMED',
        setup_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.familyId)

    if (updateError) {
      return NextResponse.json({ detail: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: 'Plan confirmado. Configuración completa.',
      setupComplete: true,
    })
  } catch (e) {
    console.error('POST /api/setup/plan/confirm:', e)
    return NextResponse.json({ detail: 'Error al confirmar plan' }, { status: 500 })
  }
}
