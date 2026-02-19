-- ============================================
-- SCRIPT: Corregir RLS para Ver Miembros de Familia
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- Verificar que RLS esté habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ELIMINAR POLÍTICAS EXISTENTES (evitar conflictos)
-- ============================================
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view family users" ON users;
DROP POLICY IF EXISTS "Users can view family members" ON users;

-- ============================================
-- VERIFICAR QUE LAS FUNCIONES HELPER EXISTAN
-- ============================================
-- Si no existen, crearlas
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

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO anon;

-- ============================================
-- POLÍTICAS RLS PARA VER MIEMBROS DE FAMILIA
-- ============================================

-- Política 1: Los usuarios pueden VER sus propios datos
CREATE POLICY "Users can view own data" ON users
    FOR SELECT 
    USING (auth.uid() = id);

-- Política 2: Los usuarios pueden VER otros miembros de su familia
-- Esto permite que cualquier usuario de la familia vea a otros miembros
-- (necesario para seleccionar integrantes en presupuestos)
CREATE POLICY "Users can view family members" ON users
    FOR SELECT 
    USING (
        -- Puede ver su propio perfil
        id = auth.uid()
        OR
        -- O puede ver usuarios de su familia (usando función para evitar recursión)
        (
            family_id IS NOT NULL
            AND family_id = public.get_user_family_id(auth.uid())
            AND family_id IN (
                SELECT family_id 
                FROM public.users 
                WHERE id = auth.uid()
            )
        )
    );

-- Política 3: Los administradores pueden VER usuarios de su familia (más permisiva)
-- Esta política es redundante pero más explícita para admins
CREATE POLICY "Admins can view family users" ON users
    FOR SELECT 
    USING (
        -- Puede ver su propio perfil
        id = auth.uid()
        OR
        -- O puede ver usuarios de su familia si es admin
        (
            public.is_family_admin(auth.uid()) = true
            AND family_id = public.get_user_family_id(auth.uid())
            AND family_id IS NOT NULL
        )
    );

-- ============================================
-- VERIFICAR POLÍTICAS CREADAS
-- ============================================
SELECT 
    'Políticas de SELECT en users' as verificacion,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 150)
        ELSE 'Sin USING'
    END as using_clause
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;

-- ============================================
-- PROBAR LA CONSULTA
-- ============================================
-- Esta consulta debería funcionar para cualquier usuario de una familia
-- Reemplaza 'TU-USER-ID' con tu user_id real
/*
SELECT 
    id,
    email,
    name,
    family_id,
    is_family_admin,
    is_active
FROM users
WHERE family_id = (SELECT family_id FROM users WHERE id = 'TU-USER-ID'::UUID)
AND is_active = true;
*/
