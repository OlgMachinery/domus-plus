-- ============================================
-- FLUJO COMPLETO: Crear Familia y Asignar Usuarios
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- ============================================
-- PASO 1: Crear Familia
-- ============================================
CREATE OR REPLACE FUNCTION public.create_family(
  p_family_name TEXT,
  p_admin_user_id UUID DEFAULT NULL
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
BEGIN
  -- Crear la familia
  INSERT INTO public.families (name, admin_id, created_at, updated_at)
  VALUES (
    p_family_name,
    COALESCE(p_admin_user_id, auth.uid()),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_family_id;
  
  -- Retornar resultado
  RETURN QUERY SELECT v_family_id, p_family_name, true, 'Familia creada exitosamente'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_family(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family(TEXT, UUID) TO anon;

-- ============================================
-- PASO 2: Asignar Usuario como Administrador
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_family_admin(
  p_user_id UUID,
  p_family_id INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_family_exists BOOLEAN;
BEGIN
  -- Verificar que el usuario existe
  SELECT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN QUERY SELECT false, 'Usuario no encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar que la familia existe
  SELECT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) INTO v_family_exists;
  IF NOT v_family_exists THEN
    RETURN QUERY SELECT false, 'Familia no encontrada'::TEXT;
    RETURN;
  END IF;
  
  -- Asignar familia al usuario y hacerlo administrador
  UPDATE public.users
  SET 
    family_id = p_family_id,
    is_family_admin = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Actualizar el admin_id de la familia
  UPDATE public.families
  SET 
    admin_id = p_user_id,
    updated_at = NOW()
  WHERE id = p_family_id;
  
  -- Retornar resultado
  RETURN QUERY SELECT true, 'Usuario asignado como administrador exitosamente'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_family_admin(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_family_admin(UUID, INTEGER) TO anon;

-- ============================================
-- PASO 3: Agregar Miembro a la Familia
-- ============================================
CREATE OR REPLACE FUNCTION public.add_family_member(
  p_user_id UUID,
  p_family_id INTEGER,
  p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_family_exists BOOLEAN;
  v_user_already_has_family BOOLEAN;
  v_current_admin_id UUID;
BEGIN
  -- Verificar que el usuario existe
  SELECT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RETURN QUERY SELECT false, 'Usuario no encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar que la familia existe
  SELECT EXISTS (SELECT 1 FROM families WHERE id = p_family_id) INTO v_family_exists;
  IF NOT v_family_exists THEN
    RETURN QUERY SELECT false, 'Familia no encontrada'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar si el usuario ya tiene una familia
  SELECT EXISTS (SELECT 1 FROM users WHERE id = p_user_id AND family_id IS NOT NULL) INTO v_user_already_has_family;
  IF v_user_already_has_family THEN
    RETURN QUERY SELECT false, 'El usuario ya tiene una familia asignada'::TEXT;
    RETURN;
  END IF;
  
  -- Obtener el admin actual de la familia
  SELECT admin_id INTO v_current_admin_id FROM families WHERE id = p_family_id;
  
  -- Asignar familia al usuario
  UPDATE public.users
  SET 
    family_id = p_family_id,
    is_family_admin = p_is_admin,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Si se está asignando como admin y no hay admin actual, actualizar la familia
  IF p_is_admin AND v_current_admin_id IS NULL THEN
    UPDATE public.families
    SET 
      admin_id = p_user_id,
      updated_at = NOW()
    WHERE id = p_family_id;
  END IF;
  
  -- Retornar resultado
  RETURN QUERY SELECT true, 'Miembro agregado a la familia exitosamente'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_family_member(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_family_member(UUID, INTEGER, BOOLEAN) TO anon;

-- ============================================
-- FUNCIÓN COMPLETA: Crear Familia y Asignar Admin (para compatibilidad)
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
  v_create_result RECORD;
  v_assign_result RECORD;
BEGIN
  -- Obtener datos del usuario
  SELECT u.name, u.email INTO v_user_name, v_user_email
  FROM public.users u
  WHERE u.id = p_user_id;
  
  IF v_user_name IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, false, 'Usuario no encontrado'::TEXT;
    RETURN;
  END IF;
  
  -- Verificar si el usuario ya tiene familia
  SELECT family_id INTO v_family_id
  FROM public.users
  WHERE id = p_user_id;
  
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
  
  -- PASO 1: Crear la familia
  SELECT * INTO v_create_result
  FROM public.create_family(v_family_name, p_user_id);
  
  IF NOT v_create_result.success THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, false, v_create_result.message;
    RETURN;
  END IF;
  
  v_family_id := v_create_result.family_id;
  
  -- PASO 2: Asignar usuario como administrador
  SELECT * INTO v_assign_result
  FROM public.assign_family_admin(p_user_id, v_family_id);
  
  IF NOT v_assign_result.success THEN
    -- Si falla la asignación, eliminar la familia creada
    DELETE FROM public.families WHERE id = v_family_id;
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, false, v_assign_result.message;
    RETURN;
  END IF;
  
  -- Retornar resultado exitoso
  RETURN QUERY SELECT v_family_id, v_family_name, true, 'Familia creada y usuario asignado como administrador exitosamente'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_family_for_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family_for_user(UUID, TEXT) TO anon;

-- ============================================
-- VERIFICAR QUE SE CREARON CORRECTAMENTE
-- ============================================
SELECT 
    'Funciones creadas' as verificacion,
    proname,
    prokind
FROM pg_proc
WHERE proname IN ('create_family', 'assign_family_admin', 'add_family_member', 'create_family_for_user')
ORDER BY proname;

-- ============================================
-- EJEMPLO DE USO (Paso a Paso)
-- ============================================

-- Ejemplo 1: Crear familia y asignar admin en pasos separados
/*
-- Paso 1: Crear la familia
SELECT * FROM create_family('Mi Familia', 'TU-USER-ID-AQUI'::UUID);

-- Paso 2: Asignar usuario como administrador (si no se pasó en el paso 1)
SELECT * FROM assign_family_admin('TU-USER-ID-AQUI'::UUID, 1); -- Reemplaza 1 con el family_id retornado

-- Paso 3: Agregar miembros adicionales
SELECT * FROM add_family_member('OTRO-USER-ID'::UUID, 1, false); -- false = no es admin
*/

-- Ejemplo 2: Usar la función completa (todo en uno)
/*
SELECT * FROM create_family_for_user('TU-USER-ID-AQUI'::UUID, 'Mi Familia');
*/
