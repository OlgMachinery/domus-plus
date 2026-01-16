-- 🔧 Crear Usuario Manualmente en Supabase
-- Ejecuta esto en Supabase SQL Editor si el usuario no existe en la tabla users

-- Reemplaza 'TU_EMAIL_AQUI' con tu email real
-- Ejecuta este SQL en: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new

-- 1. Primero, encuentra tu ID de usuario en auth.users
SELECT id, email, created_at
FROM auth.users
WHERE email = 'gonzalomail@me.com';

-- 2. Luego, crea el usuario en la tabla users (reemplaza el ID con el que obtuviste arriba)
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1), 'Usuario'),
    COALESCE(au.raw_user_meta_data->>'phone', ''),
    true,
    false,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.email = 'gonzalomail@me.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = au.id
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Verificar que se creó
SELECT id, email, name, phone, is_active, is_family_admin
FROM public.users
WHERE email = 'gonzalomail@me.com';
