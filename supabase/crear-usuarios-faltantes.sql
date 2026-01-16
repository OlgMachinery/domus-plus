-- Crear usuarios en tabla users que existen en auth.users pero no en users
-- Ejecuta esto en Supabase SQL Editor

-- Ver usuarios que faltan en la tabla users
SELECT 
    '=== USUARIOS QUE FALTAN EN TABLA users ===' as info,
    au.id,
    au.email,
    au.created_at,
    '❌ No existe en tabla users' as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;

-- Crear los usuarios faltantes
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', 'Usuario'),
    COALESCE(au.raw_user_meta_data->>'phone', ''),
    true,
    false
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verificar resultado
SELECT 
    '=== VERIFICACIÓN FINAL ===' as info,
    COUNT(*) as total_usuarios_creados
FROM public.users;

-- Listar todos los usuarios
SELECT 
    id,
    email,
    name,
    phone,
    is_active,
    '✅ Usuario completo' as status
FROM public.users
ORDER BY created_at DESC;
