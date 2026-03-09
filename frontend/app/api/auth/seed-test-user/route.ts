import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Crea un usuario admin de prueba en Auth y en public.users.
 * Solo disponible en desarrollo o cuando ALLOW_SEED_TEST_USER=true.
 * Uso: POST /api/auth/seed-test-user (sin body) o GET para ver instrucciones.
 */
const TEST_EMAIL = 'admin@domus.local'
const TEST_PASSWORD = 'Admin123!'

function isSeedAllowed(): boolean {
  if (process.env.ALLOW_SEED_TEST_USER === 'true') return true
  if (process.env.NODE_ENV === 'development') return true
  return false
}

export async function GET() {
  if (!isSeedAllowed()) {
    return NextResponse.json(
      { detail: 'No permitido. Usa POST para crear el usuario. Solo en desarrollo o con ALLOW_SEED_TEST_USER=true.' },
      { status: 403 }
    )
  }
  return NextResponse.json({
    message: 'Para crear el usuario admin de prueba, envía POST a esta misma URL.',
    example: 'curl -X POST http://localhost:3000/api/auth/seed-test-user',
    credentials: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
}

export async function POST() {
  if (!isSeedAllowed()) {
    return NextResponse.json(
      { detail: 'Seed solo permitido en desarrollo o con ALLOW_SEED_TEST_USER=true' },
      { status: 403 }
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      {
        detail: 'Faltan variables de entorno en el servidor.',
        hint: 'En frontend/.env.local añade NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY). En Supabase: Project Settings → API → project URL y "service_role" key. Reinicia "npm run dev" después de guardar.',
      },
      { status: 500 }
    )
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Crear o actualizar usuario en Auth (email confirmado)
  let authUser: { id: string } | null = null

  // Intentar con SDK
  const { data: existing } = await admin.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === TEST_EMAIL)
  if (found) {
    await admin.auth.admin.updateUserById(found.id, { email_confirm: true })
    authUser = { id: found.id }
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'Admin Prueba' },
    })
    if (!createError && created?.user) {
      authUser = { id: created.user.id }
    } else if (createError?.message === 'Invalid API key') {
      // Fallback: API REST de Auth acepta sb_secret_ en algunos proyectos
      const authUrl = url.replace(/\/$/, '') + '/auth/v1/admin/users'
      const res = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          email_confirm: true,
          user_metadata: { name: 'Admin Prueba' },
        }),
      })
      const json = await res.json().catch(() => ({}))
      const userId = json?.id ?? json?.user?.id
      if (res.ok && userId) {
        authUser = { id: userId }
      } else {
        const errMsg = json?.msg || json?.message || json?.error_description || res.statusText
        return NextResponse.json(
          {
            detail: `Error al crear usuario en Auth (REST): ${errMsg}. Si tu proyecto solo tiene claves nuevas (sb_secret_), prueba crear usuario en /register y desactivar "Confirm email" en Supabase → Authentication → Providers → Email.`,
          },
          { status: 500 }
        )
      }
    } else {
      const msg = createError?.message || 'desconocido'
      return NextResponse.json(
        { detail: `Error al crear usuario en Auth: ${msg}` },
        { status: 500 }
      )
    }
  }

  if (!authUser) {
    return NextResponse.json({ detail: 'No se pudo obtener el usuario de Auth' }, { status: 500 })
  }

  // Insertar o actualizar en public.users (service role bypasea RLS)
  const { data: existingUser } = await admin.from('users').select('id').eq('id', authUser.id).single()
  if (existingUser) {
    await admin.from('users').update({ is_family_admin: true, is_active: true }).eq('id', authUser.id)
  } else {
    const { error: insertError } = await admin.from('users').insert({
      id: authUser.id,
      email: TEST_EMAIL,
      phone: '5500000000',
      name: 'Admin Prueba',
      is_active: true,
      is_family_admin: true,
    })
    if (insertError) {
      return NextResponse.json(
        { detail: `Error al crear fila en public.users: ${insertError.message}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    message: 'Usuario admin de prueba listo. Usa estas credenciales para entrar.',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    login_url: '/login',
  })
}
