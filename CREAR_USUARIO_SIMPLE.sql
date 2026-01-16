-- 🔧 SOLUCIÓN SIMPLE: Crear usuario en la base de datos
-- Ejecuta esto en Supabase SQL Editor: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new
-- Copia TODO este código y pégalo en el editor, luego haz clic en "Run"

-- Crear el usuario gonzalomail@me.com si no existe
INSERT INTO public.users (
  id, 
  email, 
  name, 
  phone, 
  is_active, 
  is_family_admin,
  created_at,
  updated_at
)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1), 'Gonzalo Montaño'),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  true,
  false,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
WHERE au.email = 'gonzalomail@me.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = au.id
  )
ON CONFLICT (id) DO NOTHING;

-- Verificar que se creó
SELECT 
  id,
  email,
  name,
  is_active,
  created_at
FROM public.users
WHERE email = 'gonzalomail@me.com';

-- Si ves una fila con tus datos, ¡está listo! ✅
