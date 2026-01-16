-- Verificar si el usuario se creó correctamente
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar en auth.users
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    '✅ Usuario en auth.users' as status
FROM auth.users
WHERE email = 'gonzalomail@me.com';

-- 2. Verificar en tabla users
SELECT 
    id,
    email,
    name,
    phone,
    is_active,
    created_at,
    '✅ Usuario en tabla users' as status
FROM public.users
WHERE email = 'gonzalomail@me.com';

-- 3. Verificar si coinciden los IDs
SELECT 
    au.id as auth_id,
    u.id as user_id,
    CASE 
        WHEN au.id = u.id THEN '✅ IDs coinciden'
        ELSE '❌ IDs NO coinciden'
    END as match_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email = 'gonzalomail@me.com';
