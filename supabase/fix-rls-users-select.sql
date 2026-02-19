-- Solución: Política RLS para permitir que usuarios vean sus propios datos
-- Ejecuta esto en Supabase SQL Editor

-- Verificar políticas actuales
SELECT 
    'Políticas actuales de SELECT en users' as verificacion,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT';

-- Eliminar políticas conflictivas
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view family users" ON users;

-- Política: Los usuarios pueden VER sus propios datos
CREATE POLICY "Users can view own data" ON users
    FOR SELECT 
    USING (auth.uid() = id);

-- Política: Los administradores pueden VER usuarios de su familia
CREATE POLICY "Admins can view family users" ON users
    FOR SELECT 
    USING (
        -- Puede ver su propio perfil
        id = auth.uid()
        OR
        -- O puede ver usuarios de su familia si es admin
        (
            family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    );

-- Verificar que RLS está habilitado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Verificar que se crearon correctamente
SELECT 
    'Políticas después de crear' as verificacion,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'SELECT'
ORDER BY policyname;
