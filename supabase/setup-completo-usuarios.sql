-- 🚀 SETUP COMPLETO: Usuarios y Recibos
-- Ejecuta esto UNA VEZ en Supabase SQL Editor
-- Esto configura todo lo necesario para que funcione el sistema de recibos

-- ============================================
-- PASO 1: CREAR FUNCIÓN AUTOMÁTICA DE USUARIOS
-- ============================================

-- Función que crea el usuario si no existe (con permisos de administrador)
CREATE OR REPLACE FUNCTION public.ensure_user_exists(
  p_user_id UUID, 
  p_email TEXT, 
  p_name TEXT DEFAULT NULL, 
  p_phone TEXT DEFAULT NULL
)
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

-- ============================================
-- PASO 2: ASEGURAR POLÍTICAS RLS PARA USERS
-- ============================================

-- Habilitar RLS en la tabla users si no está habilitado
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- Política: Los usuarios pueden VER su propio perfil
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT 
  USING (auth.uid() = id);

-- Política: Los usuarios pueden INSERTAR su propio perfil (para auto-creación)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Política: Los usuarios pueden ACTUALIZAR su propio perfil
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PASO 3: CREAR USUARIOS EXISTENTES
-- ============================================

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
  ) as name,
  COALESCE(au.raw_user_meta_data->>'phone', NULL) as phone,
  true,
  false,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
  AND au.email IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- ============================================
-- PASO 4: VERIFICAR RESULTADOS
-- ============================================

-- Verificar usuarios creados
SELECT 
  'Usuarios en auth.users' as tipo,
  COUNT(*) as total
FROM auth.users
WHERE email IS NOT NULL
UNION ALL
SELECT 
  'Usuarios en public.users' as tipo,
  COUNT(*) as total
FROM public.users
UNION ALL
SELECT 
  'Usuarios activos' as tipo,
  COUNT(*) as total
FROM public.users
WHERE is_active = true;

-- Verificar función creada
SELECT 
  proname as function_name,
  proargnames as parameters,
  prosecdef as security_definer
FROM pg_proc
WHERE proname = 'ensure_user_exists';

-- Verificar políticas RLS en users
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
