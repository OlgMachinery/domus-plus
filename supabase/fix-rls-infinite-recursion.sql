-- Solución: Corregir recursión infinita en políticas RLS de users
-- El error "infinite recursion detected in policy for relation 'users'" ocurre
-- cuando una política intenta consultar la misma tabla que protege.
-- Ejecuta esto en Supabase SQL Editor

-- ============================================
-- PASO 1: ELIMINAR TODAS LAS POLÍTICAS CONFLICTIVAS
-- ============================================
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view family users" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can update family users" ON users;

-- ============================================
-- PASO 2: CREAR FUNCIÓN SECURITY DEFINER PARA OBTENER FAMILY_ID
-- ============================================
-- Esta función evita la recursión porque se ejecuta con privilegios elevados
CREATE OR REPLACE FUNCTION public.get_user_family_id(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id INTEGER;
BEGIN
  SELECT family_id INTO v_family_id
  FROM public.users
  WHERE id = p_user_id;
  
  RETURN v_family_id;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO anon;

-- ============================================
-- PASO 3: CREAR FUNCIÓN PARA VERIFICAR SI ES ADMIN
-- ============================================
CREATE OR REPLACE FUNCTION public.is_family_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_family_admin INTO v_is_admin
  FROM public.users
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO anon;

-- ============================================
-- PASO 4: CREAR POLÍTICAS SIN RECURSIÓN
-- ============================================

-- Política 1: Los usuarios pueden VER sus propios datos
-- Esta política NO consulta la tabla users, solo compara auth.uid() con id
CREATE POLICY "Users can view own data" ON users
    FOR SELECT 
    USING (auth.uid() = id);

-- Política 2: Los administradores pueden VER usuarios de su familia
-- Usa las funciones SECURITY DEFINER para evitar recursión
CREATE POLICY "Admins can view family users" ON users
    FOR SELECT 
    USING (
        -- Puede ver su propio perfil (sin recursión)
        id = auth.uid()
        OR
        -- O puede ver usuarios de su familia si es admin (usando función)
        (
            public.is_family_admin(auth.uid()) = true
            AND family_id = public.get_user_family_id(auth.uid())
            AND family_id IS NOT NULL
        )
    );

-- Política 3: Los usuarios pueden INSERTAR sus propios datos
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Política 4: Los administradores pueden INSERTAR usuarios en su familia
CREATE POLICY "Admins can insert users" ON users
    FOR INSERT 
    WITH CHECK (
        public.is_family_admin(auth.uid()) = true
        AND family_id = public.get_user_family_id(auth.uid())
        AND family_id IS NOT NULL
    );

-- Política 5: Los usuarios pueden ACTUALIZAR sus propios datos
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Política 6: Los administradores pueden ACTUALIZAR usuarios de su familia
CREATE POLICY "Admins can update family users" ON users
    FOR UPDATE 
    USING (
        id = auth.uid()
        OR
        (
            public.is_family_admin(auth.uid()) = true
            AND family_id = public.get_user_family_id(auth.uid())
            AND family_id IS NOT NULL
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR
        (
            public.is_family_admin(auth.uid()) = true
            AND family_id = public.get_user_family_id(auth.uid())
            AND family_id IS NOT NULL
        )
    );

-- ============================================
-- PASO 5: VERIFICAR QUE RLS ESTÁ HABILITADO
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PASO 6: VERIFICAR POLÍTICAS CREADAS
-- ============================================
SELECT 
    'Políticas creadas' as verificacion,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%auth.uid()%' THEN 'Sin recursión (usa auth.uid())'
        WHEN qual LIKE '%public.is_family_admin%' THEN 'Sin recursión (usa función)'
        ELSE 'Revisar'
    END as tipo
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;
