-- Función para crear familia automáticamente sin recursión RLS
-- Ejecuta esto en Supabase SQL Editor

-- ============================================
-- FUNCIÓN: Crear familia automáticamente para un usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.create_family_for_user(
  p_user_id UUID,
  p_family_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  family_id INTEGER,
  family_name TEXT,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id INTEGER;
  v_user_name TEXT;
  v_user_email TEXT;
  v_family_name TEXT;
BEGIN
  -- Obtener datos del usuario (usando alias para evitar ambigüedad)
  SELECT u.name, u.email INTO v_user_name, v_user_email
  FROM public.users u
  WHERE u.id = p_user_id;
  
  IF v_user_name IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, false, 'Usuario no encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar si el usuario ya tiene familia (usando alias)
  SELECT u.family_id INTO v_family_id
  FROM public.users u
  WHERE u.id = p_user_id;
  
  IF v_family_id IS NOT NULL THEN
    RETURN QUERY SELECT v_family_id, NULL::TEXT, false, 'El usuario ya tiene una familia asignada'::TEXT;
    RETURN;
  END IF;
  
  -- Determinar nombre de la familia
  IF p_family_name IS NOT NULL AND p_family_name != '' THEN
    v_family_name := p_family_name;
  ELSE
    v_family_name := COALESCE('Familia de ' || v_user_name, 'Familia de ' || SPLIT_PART(v_user_email, '@', 1), 'Mi Familia');
  END IF;
  
  -- Crear familia
  INSERT INTO public.families (name, admin_id, created_at, updated_at)
  VALUES (v_family_name, p_user_id, NOW(), NOW())
  RETURNING id INTO v_family_id;
  
  -- Asignar familia al usuario y hacerlo admin (usando alias explícito)
  UPDATE public.users u
  SET 
    family_id = v_family_id,
    is_family_admin = TRUE,
    updated_at = NOW()
  WHERE u.id = p_user_id;
  
  -- Retornar resultado
  RETURN QUERY SELECT v_family_id, v_family_name, true, 'Familia creada exitosamente'::TEXT;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.create_family_for_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family_for_user(UUID, TEXT) TO anon;

-- ============================================
-- VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- ============================================
SELECT 
    'Función creada' as verificacion,
    proname,
    prokind
FROM pg_proc
WHERE proname = 'create_family_for_user';
