-- Script completo para verificar y corregir políticas RLS para registro de usuarios
-- Ejecuta esto en Supabase SQL Editor

-- ============================================
-- PASO 1: VERIFICAR POLÍTICAS ACTUALES
-- ============================================
SELECT 
    'Políticas actuales de INSERT en users' as verificacion,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';

-- ============================================
-- PASO 2: ELIMINAR POLÍTICAS CONFLICTIVAS
-- ============================================
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own data" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- ============================================
-- PASO 3: CREAR POLÍTICA CORRECTA
-- ============================================
-- Política que permite a usuarios insertar su propio registro durante el registro
-- Durante signUp, auth.uid() está disponible y coincide con el id del usuario
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND auth.uid() = id
    );

-- ============================================
-- PASO 4: VERIFICAR QUE SE CREÓ CORRECTAMENTE
-- ============================================
SELECT 
    'Políticas después de crear' as verificacion,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';

-- ============================================
-- PASO 5: VERIFICAR QUE RLS ESTÁ HABILITADO
-- ============================================
SELECT 
    'RLS habilitado en users' as verificacion,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';

-- Si RLS no está habilitado, ejecutar:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
