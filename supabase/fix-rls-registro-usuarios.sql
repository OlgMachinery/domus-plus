-- Solución: Política RLS para permitir que usuarios se registren (INSERT durante registro)
-- Ejecuta esto en Supabase SQL Editor

-- Eliminar política existente si hay conflictos
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Política: Los usuarios pueden INSERTAR su propio registro durante el registro
-- Durante signUp, auth.uid() está disponible, así que esto debería funcionar
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Verificar que se creó correctamente
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
