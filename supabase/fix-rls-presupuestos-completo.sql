-- ============================================
-- SCRIPT COMPLETO: Corregir RLS para Presupuestos
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- Verificar que RLS esté habilitado
ALTER TABLE family_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ELIMINAR POLÍTICAS EXISTENTES (evitar conflictos)
-- ============================================

-- Family Budgets
DROP POLICY IF EXISTS "Users can view family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can insert family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can update family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can delete family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can insert budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can update budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can delete budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can insert own individual budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can update own individual budgets" ON family_budgets;

-- User Budgets
DROP POLICY IF EXISTS "Users can view own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Users can insert own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Users can update own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Family admins can insert user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Family admins can update user budgets" ON user_budgets;

-- ============================================
-- CREAR FUNCIONES HELPER (evitar recursión)
-- ============================================

-- Función para obtener si el usuario es admin de familia
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

-- Función para obtener el family_id del usuario
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

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO anon;

-- ============================================
-- POLÍTICAS RLS PARA FAMILY_BUDGETS
-- ============================================

-- SELECT: Todos los usuarios de la familia pueden ver presupuestos de su familia
CREATE POLICY "Users can view family budgets" ON family_budgets
    FOR SELECT 
    USING (
        family_id = public.get_user_family_id(auth.uid())
        AND family_id IS NOT NULL
    );

-- INSERT: Solo administradores de familia pueden crear presupuestos
CREATE POLICY "Family admins can insert budgets" ON family_budgets
    FOR INSERT 
    WITH CHECK (
        public.is_family_admin(auth.uid()) = true
        AND family_id = public.get_user_family_id(auth.uid())
        AND family_id IS NOT NULL
    );

-- UPDATE: Solo administradores de familia pueden actualizar presupuestos
CREATE POLICY "Family admins can update budgets" ON family_budgets
    FOR UPDATE 
    USING (
        public.is_family_admin(auth.uid()) = true
        AND family_id = public.get_user_family_id(auth.uid())
        AND family_id IS NOT NULL
    )
    WITH CHECK (
        public.is_family_admin(auth.uid()) = true
        AND family_id = public.get_user_family_id(auth.uid())
        AND family_id IS NOT NULL
    );

-- DELETE: Solo administradores de familia pueden eliminar presupuestos
CREATE POLICY "Family admins can delete budgets" ON family_budgets
    FOR DELETE 
    USING (
        public.is_family_admin(auth.uid()) = true
        AND family_id = public.get_user_family_id(auth.uid())
        AND family_id IS NOT NULL
    );

-- ============================================
-- POLÍTICAS RLS PARA USER_BUDGETS
-- ============================================

-- SELECT: Los usuarios pueden ver sus propios presupuestos de usuario
CREATE POLICY "Users can view own user budgets" ON user_budgets
    FOR SELECT 
    USING (user_id = auth.uid());

-- INSERT: Los administradores de familia pueden crear presupuestos de usuario para miembros de su familia
CREATE POLICY "Family admins can insert user budgets" ON user_budgets
    FOR INSERT 
    WITH CHECK (
        public.is_family_admin(auth.uid()) = true
        AND user_id IN (
            SELECT id 
            FROM public.users 
            WHERE family_id = public.get_user_family_id(auth.uid())
        )
    );

-- UPDATE: Los administradores de familia pueden actualizar presupuestos de usuario de su familia
CREATE POLICY "Family admins can update user budgets" ON user_budgets
    FOR UPDATE 
    USING (
        public.is_family_admin(auth.uid()) = true
        AND user_id IN (
            SELECT id 
            FROM public.users 
            WHERE family_id = public.get_user_family_id(auth.uid())
        )
    )
    WITH CHECK (
        public.is_family_admin(auth.uid()) = true
        AND user_id IN (
            SELECT id 
            FROM public.users 
            WHERE family_id = public.get_user_family_id(auth.uid())
        )
    );

-- ============================================
-- VERIFICAR POLÍTICAS CREADAS
-- ============================================

SELECT 
    'family_budgets' as tabla,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || substring(qual::text, 1, 100)
        ELSE 'Sin USING'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || substring(with_check::text, 1, 100)
        ELSE 'Sin WITH CHECK'
    END as with_check_clause
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;

SELECT 
    'user_budgets' as tabla,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'USING: ' || substring(qual::text, 1, 100)
        ELSE 'Sin USING'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || substring(with_check::text, 1, 100)
        ELSE 'Sin WITH CHECK'
    END as with_check_clause
FROM pg_policies 
WHERE tablename = 'user_budgets'
ORDER BY cmd, policyname;

-- ============================================
-- VERIFICAR QUE EL USUARIO ACTUAL TENGA PERMISOS
-- ============================================

-- Reemplaza 'TU-USER-ID-AQUI' con tu user_id real
-- SELECT 
--     id,
--     email,
--     name,
--     family_id,
--     is_family_admin,
--     CASE 
--         WHEN is_family_admin = true THEN '✅ Puede crear presupuestos'
--         ELSE '❌ No puede crear presupuestos (no es admin)'
--     END as permisos
-- FROM users
-- WHERE id = 'TU-USER-ID-AQUI'::UUID;
