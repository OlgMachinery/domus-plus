-- Confirmar email y sincronizar usuario
-- Ejecuta esto en Supabase SQL Editor

-- 1. Confirmar email del usuario
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'gonzalomail@me.com';

-- 2. Crear/actualizar usuario en tabla users
-- Usa INSERT ... ON CONFLICT para crear o actualizar
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', 'Gonzalo Montaño'),
    COALESCE(au.raw_user_meta_data->>'phone', '+526865690472'),
    true,
    false  -- Corregido: era 'falce'
FROM auth.users au
WHERE au.email = 'gonzalomail@me.com'
ON CONFLICT (id) 
DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    updated_at = NOW();

-- 3. Verificar que se creó/actualizó correctamente
SELECT 
    u.id,
    u.email,
    u.name,
    u.phone,
    u.is_active,
    u.is_family_admin,
    au.email_confirmed_at
FROM public.users u
JOIN auth.users au ON u.id = au.id
WHERE u.email = 'gonzalomail@me.com';
