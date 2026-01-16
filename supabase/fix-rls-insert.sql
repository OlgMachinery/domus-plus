-- Solución: Política RLS para permitir INSERT durante registro
-- Ejecuta esto en Supabase SQL Editor

-- Primero, eliminar la política existente si hay problemas
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Crear política que permita INSERT durante el registro
-- Durante signUp, auth.uid() está disponible, así que esto debería funcionar
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Alternativa: Si la anterior no funciona, usar esta (más permisiva pero segura)
-- Solo permite INSERT si el id coincide con el usuario autenticado
-- DROP POLICY IF EXISTS "Users can insert own data" ON users;
-- CREATE POLICY "Users can insert own data" ON users
--     FOR INSERT 
--     WITH CHECK (
--         auth.uid() IS NOT NULL AND 
--         auth.uid() = id
--     );

-- Verificar que se creó correctamente
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
