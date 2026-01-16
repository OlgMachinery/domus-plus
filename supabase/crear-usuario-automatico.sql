-- 🔧 FUNCIÓN AUTOMÁTICA: Crear usuario en tabla users cuando se autentica
-- Ejecuta esto UNA VEZ en Supabase SQL Editor
-- Esta función se ejecutará automáticamente cuando sea necesario

-- Función que crea el usuario si no existe (con permisos de administrador)
CREATE OR REPLACE FUNCTION public.ensure_user_exists(p_user_id UUID, p_email TEXT, p_name TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  email TEXT,
  name TEXT,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos de administrador, evita problemas de RLS
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_active BOOLEAN;
BEGIN
  -- Intentar obtener el usuario existente
  SELECT u.id, u.email, u.name, u.is_active
  INTO v_user_id, v_user_email, v_user_name, v_user_active
  FROM public.users u
  WHERE u.id = p_user_id;
  
  -- Si no existe, crearlo
  IF v_user_id IS NULL THEN
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
    VALUES (
      p_user_id,
      p_email,
      COALESCE(p_name, SPLIT_PART(p_email, '@', 1), 'Usuario'),
      p_phone,
      true,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      updated_at = NOW()
    RETURNING users.id, users.email, users.name, users.is_active
    INTO v_user_id, v_user_email, v_user_name, v_user_active;
    
    -- Si aún no se obtuvo (por el ON CONFLICT), obtenerlo de nuevo
    IF v_user_id IS NULL THEN
      SELECT u.id, u.email, u.name, u.is_active
      INTO v_user_id, v_user_email, v_user_name, v_user_active
      FROM public.users u
      WHERE u.id = p_user_id;
    END IF;
  END IF;
  
  -- Retornar el usuario (creado o existente)
  RETURN QUERY SELECT v_user_id, v_user_email, v_user_name, v_user_active;
END;
$$;

-- Dar permisos para que los usuarios autenticados puedan ejecutar esta función
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_exists(UUID, TEXT, TEXT, TEXT) TO anon;

-- Crear usuarios existentes que no están en la tabla users
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
ON CONFLICT (id) DO NOTHING;

-- Verificar usuarios creados
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN is_active THEN 1 END) as usuarios_activos
FROM public.users;
