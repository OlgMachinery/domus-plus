-- Script completo para verificar y corregir el usuario
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar estado actual
SELECT 
    '=== ESTADO ACTUAL ===' as info;

SELECT 
    'auth.users' as tabla,
    id,
    email,
    email_confirmed_at,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmado'
        ELSE '❌ NO confirmado'
    END as status_email
FROM auth.users
WHERE email = 'gonzalomail@me.com';

SELECT 
    'public.users' as tabla,
    id,
    email,
    name,
    phone,
    is_active,
    CASE 
        WHEN is_active THEN '✅ Activo'
        ELSE '❌ Inactivo'
    END as status
FROM public.users
WHERE email = 'gonzalomail@me.com';

-- 2. Confirmar email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'gonzalomail@me.com';

-- 3. Crear/actualizar usuario en tabla users si no existe
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'name', 'Gonzalo Montaño'),
    COALESCE(raw_user_meta_data->>'phone', '+526865690472'),
    true,
    false
FROM auth.users
WHERE email = 'gonzalomail@me.com'
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
    is_active = true;

-- 4. Verificar resultado final
SELECT 
    '=== ESTADO FINAL ===' as info;

SELECT 
    'auth.users' as tabla,
    id,
    email,
    email_confirmed_at,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmado'
        ELSE '❌ NO confirmado'
    END as status_email
FROM auth.users
WHERE email = 'gonzalomail@me.com';

SELECT 
    'public.users' as tabla,
    id,
    email,
    name,
    phone,
    is_active,
    CASE 
        WHEN is_active THEN '✅ Activo'
        ELSE '❌ Inactivo'
    END as status
FROM public.users
WHERE email = 'gonzalomail@me.com';

-- 5. Verificar que los IDs coinciden
SELECT 
    '=== VERIFICACIÓN DE IDs ===' as info,
    au.id as auth_id,
    u.id as user_id,
    CASE 
        WHEN au.id = u.id THEN '✅ IDs coinciden'
        ELSE '❌ IDs NO coinciden'
    END as match_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email = 'gonzalomail@me.com';
