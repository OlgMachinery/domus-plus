-- 🔧 SOLUCIÓN: Usuario no encontrado en la base de datos
-- Ejecuta esto en Supabase SQL Editor: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj/sql/new

-- Esta función crea automáticamente usuarios que existen en auth.users pero no en public.users
-- Se ejecuta con permisos de administrador (SECURITY DEFINER) para evitar problemas de RLS

CREATE OR REPLACE FUNCTION public.sync_missing_users()
RETURNS TABLE(
  created_count INTEGER,
  user_emails TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_emails TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Insertar usuarios que existen en auth.users pero no en public.users
  WITH inserted_users AS (
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
      COALESCE(
        au.raw_user_meta_data->>'name',
        SPLIT_PART(au.email, '@', 1),
        'Usuario'
      ),
      COALESCE(au.raw_user_meta_data->>'phone', ''),
      true,
      false,
      COALESCE(au.created_at, NOW()),
      NOW()
    FROM auth.users au
    LEFT JOIN public.users u ON au.id = u.id
    WHERE u.id IS NULL
      AND au.email IS NOT NULL
    ON CONFLICT (id) DO NOTHING
    RETURNING email
  )
  SELECT 
    COUNT(*),
    ARRAY_AGG(email)
  INTO v_count, v_emails
  FROM inserted_users;
  
  RETURN QUERY SELECT v_count, v_emails;
END;
$$;

-- Ejecutar la función para crear usuarios faltantes
SELECT * FROM public.sync_missing_users();

-- Verificar usuarios creados
SELECT 
  u.id,
  u.email,
  u.name,
  u.is_active,
  u.created_at
FROM public.users u
ORDER BY u.created_at DESC
LIMIT 10;
