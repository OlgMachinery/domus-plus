-- Verificar que la política de INSERT existe
-- Ejecuta esto en Supabase SQL Editor para verificar

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' 
ORDER BY policyname;

-- Deberías ver 3 políticas:
-- 1. "Users can insert own data" (cmd: INSERT)
-- 2. "Users can update own data" (cmd: UPDATE)
-- 3. "Users can view own data" (cmd: SELECT)
