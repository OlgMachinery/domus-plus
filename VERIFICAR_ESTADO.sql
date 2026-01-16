-- Verificar que todo está configurado correctamente
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar que la política de INSERT existe
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN cmd = 'INSERT' THEN '✅ INSERT permitido'
        WHEN cmd = 'SELECT' THEN '✅ SELECT permitido'
        WHEN cmd = 'UPDATE' THEN '✅ UPDATE permitido'
        ELSE cmd::text
    END as status
FROM pg_policies 
WHERE tablename = 'users' 
ORDER BY cmd;

-- 2. Verificar que las tablas existen
SELECT 
    table_name,
    '✅ Tabla existe' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 3. Verificar que RLS está habilitado en users
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS habilitado'
        ELSE '❌ RLS deshabilitado'
    END as status
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename = 'users';
