import { NextResponse } from 'next/server'

/**
 * Diagnóstico de variables de entorno (solo dev).
 * GET /api/dev/env-check → indica qué variables están definidas (sin mostrar valores).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.ALLOW_SEED_TEST_USER === 'true'

  if (!isDev) {
    return NextResponse.json({ detail: 'Solo en desarrollo' }, { status: 403 })
  }

  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: !!process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
  }

  const anonOk =
    vars.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceRoleOk =
    vars.SUPABASE_SERVICE_ROLE_KEY || vars.SUPABASE_SECRET_KEY
  const seedReady = vars.NEXT_PUBLIC_SUPABASE_URL && serviceRoleOk

  return NextResponse.json({
    env: vars,
    summary: {
      login_ready: vars.NEXT_PUBLIC_SUPABASE_URL && anonOk,
      seed_test_user_ready: seedReady,
    },
    hint: !seedReady
      ? 'Para seed-test-user: en frontend/.env.local define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY). Valores en Supabase → Project Settings → API.'
      : undefined,
  })
}
