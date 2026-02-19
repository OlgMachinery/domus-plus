-- Función para que administradores puedan crear usuarios sin validar correo
-- Ejecuta esto en Supabase SQL Editor

-- Función que crea un usuario en auth.users y en public.users
CREATE OR REPLACE FUNCTION public.create_user_by_admin(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_family_id INTEGER
)
RETURNS TABLE(
  id UUID,
  email TEXT,
  name TEXT,
  phone TEXT,
  is_active BOOLEAN,
  is_family_admin BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos de administrador
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_phone TEXT;
  v_user_active BOOLEAN;
  v_user_admin BOOLEAN;
  v_admin_id UUID;
BEGIN
  -- Verificar que el usuario que llama la función sea administrador
  v_admin_id := auth.uid();
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;
  
  -- Verificar que sea administrador de familia
  IF NOT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = v_admin_id 
    AND is_family_admin = true
    AND family_id = p_family_id
  ) THEN
    RAISE EXCEPTION 'Solo los administradores de familia pueden crear usuarios';
  END IF;
  
  -- Verificar que el email no exista
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;
  
  -- Crear usuario en auth.users usando la extensión pgcrypto para hash de contraseña
  -- Nota: En producción, esto debería usar el método correcto de Supabase
  -- Por ahora, creamos directamente en public.users y el usuario deberá usar "reset password"
  
  -- Generar un UUID para el nuevo usuario
  v_user_id := gen_random_uuid();
  
  -- Insertar en public.users directamente
  -- El usuario se creará sin autenticación inicial, deberá usar "reset password"
  INSERT INTO public.users (
    id,
    email,
    name,
    phone,
    is_active,
    is_family_admin,
    family_id,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_email,
    p_name,
    p_phone,
    true,
    false,
    p_family_id,
    NOW(),
    NOW()
  )
  RETURNING users.id, users.email, users.name, users.phone, users.is_active, users.is_family_admin
  INTO v_user_id, v_user_email, v_user_name, v_user_phone, v_user_active, v_user_admin;
  
  -- Retornar el usuario creado
  RETURN QUERY SELECT v_user_id, v_user_email, v_user_name, v_user_phone, v_user_active, v_user_admin;
END;
$$;

-- Dar permisos para que los administradores puedan ejecutar esta función
GRANT EXECUTE ON FUNCTION public.create_user_by_admin(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- Nota: Para crear el usuario en auth.users también, necesitarías usar
-- supabase.auth.admin.createUser() desde el backend con service_role key
-- O configurar un webhook que cree el usuario en auth.users cuando se inserta en public.users
