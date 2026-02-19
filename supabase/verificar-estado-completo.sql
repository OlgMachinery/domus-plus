-- ============================================
-- SCRIPT DE VERIFICACIÓN COMPLETA
-- Revisa el estado actual de Supabase después de los cambios
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. VERIFICAR FUNCIONES SQL
-- ============================================
SELECT 
    'Funciones SQL' as seccion,
    proname as nombre_funcion,
    prokind as tipo,
    CASE 
        WHEN prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END as seguridad
FROM pg_proc
WHERE proname IN (
    'create_family',
    'assign_family_admin',
    'add_family_member',
    'create_family_for_user',
    'get_user_family_id',
    'is_family_admin'
)
ORDER BY proname;

-- ============================================
-- 2. VERIFICAR POLÍTICAS RLS EN USERS
-- ============================================
SELECT 
    'Políticas RLS - Users' as seccion,
    policyname,
    cmd as operacion,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 200)
        ELSE 'Sin USING'
    END as condicion_using,
    CASE 
        WHEN with_check IS NOT NULL THEN substring(with_check::text, 1, 200)
        ELSE 'Sin WITH CHECK'
    END as condicion_with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- ============================================
-- 3. VERIFICAR POLÍTICAS RLS EN FAMILY_BUDGETS
-- ============================================
SELECT 
    'Políticas RLS - Family Budgets' as seccion,
    policyname,
    cmd as operacion,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 200)
        ELSE 'Sin USING'
    END as condicion_using,
    CASE 
        WHEN with_check IS NOT NULL THEN substring(with_check::text, 1, 200)
        ELSE 'Sin WITH CHECK'
    END as condicion_with_check
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;

-- ============================================
-- 4. VERIFICAR POLÍTICAS RLS EN USER_BUDGETS
-- ============================================
SELECT 
    'Políticas RLS - User Budgets' as seccion,
    policyname,
    cmd as operacion,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 200)
        ELSE 'Sin USING'
    END as condicion_using,
    CASE 
        WHEN with_check IS NOT NULL THEN substring(with_check::text, 1, 200)
        ELSE 'Sin WITH CHECK'
    END as condicion_with_check
FROM pg_policies 
WHERE tablename = 'user_budgets'
ORDER BY cmd, policyname;

-- ============================================
-- 5. VERIFICAR RLS HABILITADO
-- ============================================
SELECT 
    'RLS Habilitado' as seccion,
    schemaname,
    tablename,
    rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'families', 'family_budgets', 'user_budgets')
ORDER BY tablename;

-- ============================================
-- 6. VERIFICAR ESTRUCTURA DE TABLAS
-- ============================================
SELECT 
    'Estructura - Users' as seccion,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'users'
ORDER BY ordinal_position;

SELECT 
    'Estructura - Families' as seccion,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'families'
ORDER BY ordinal_position;

SELECT 
    'Estructura - Family Budgets' as seccion,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'family_budgets'
ORDER BY ordinal_position;

-- ============================================
-- 7. VERIFICAR DATOS DE EJEMPLO
-- ============================================
-- Reemplaza 'TU-EMAIL' con tu email para verificar
/*
SELECT 
    'Datos Usuario' as seccion,
    id,
    email,
    name,
    family_id,
    is_family_admin,
    is_active,
    created_at
FROM users
WHERE email = 'TU-EMAIL-AQUI'
LIMIT 1;

-- Ver familias
SELECT 
    'Datos Familias' as seccion,
    id,
    name,
    admin_id,
    created_at,
    (SELECT COUNT(*) FROM users WHERE family_id = families.id) as total_miembros
FROM families
ORDER BY created_at DESC
LIMIT 5;

-- Ver miembros de una familia (reemplaza con tu family_id)
SELECT 
    'Miembros Familia' as seccion,
    id,
    email,
    name,
    is_family_admin,
    is_active
FROM users
WHERE family_id = 1  -- Reemplaza con tu family_id
ORDER BY is_family_admin DESC, name;
*/

-- ============================================
-- 8. VERIFICAR PERMISOS DE FUNCIONES
-- ============================================
SELECT 
    'Permisos Funciones' as seccion,
    p.proname as funcion,
    r.rolname as rol,
    CASE 
        WHEN has_function_privilege(r.oid, p.oid, 'EXECUTE') THEN '✅ Tiene permiso'
        ELSE '❌ Sin permiso'
    END as permiso
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN (
    'create_family',
    'assign_family_admin',
    'add_family_member',
    'create_family_for_user',
    'get_user_family_id',
    'is_family_admin'
)
AND r.rolname IN ('authenticated', 'anon', 'postgres')
ORDER BY p.proname, r.rolname;

-- ============================================
-- RESUMEN DE VERIFICACIÓN
-- ============================================
SELECT 
    'RESUMEN' as tipo,
    'Funciones creadas' as item,
    COUNT(*)::text as estado
FROM pg_proc
WHERE proname IN (
    'create_family',
    'assign_family_admin',
    'add_family_member',
    'create_family_for_user',
    'get_user_family_id',
    'is_family_admin'
)

UNION ALL

SELECT 
    'RESUMEN',
    'Políticas RLS en users',
    COUNT(*)::text
FROM pg_policies
WHERE tablename = 'users'

UNION ALL

SELECT 
    'RESUMEN',
    'Políticas RLS en family_budgets',
    COUNT(*)::text
FROM pg_policies
WHERE tablename = 'family_budgets'

UNION ALL

SELECT 
    'RESUMEN',
    'Políticas RLS en user_budgets',
    COUNT(*)::text
FROM pg_policies
WHERE tablename = 'user_budgets'

UNION ALL

SELECT 
    'RESUMEN',
    'RLS habilitado en users',
    CASE WHEN rowsecurity THEN '✅ Sí' ELSE '❌ No' END
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'users'

UNION ALL

SELECT 
    'RESUMEN',
    'RLS habilitado en family_budgets',
    CASE WHEN rowsecurity THEN '✅ Sí' ELSE '❌ No' END
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'family_budgets';
