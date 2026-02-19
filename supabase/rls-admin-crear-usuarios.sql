-- Políticas RLS para que administradores puedan crear usuarios sin validar correo
-- Ejecuta esto en Supabase SQL Editor

-- Eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can view family users" ON users;

-- Política: Los administradores de familia pueden INSERTAR usuarios en su familia
CREATE POLICY "Admins can insert users" ON users
    FOR INSERT 
    WITH CHECK (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden VER usuarios de su familia
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

-- Política: Los administradores de familia pueden ACTUALIZAR usuarios de su familia
CREATE POLICY "Admins can update family users" ON users
    FOR UPDATE 
    USING (
        -- Puede actualizar su propio perfil
        id = auth.uid()
        OR
        -- O puede actualizar usuarios de su familia si es admin
        (
            family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR
        (
            family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    );

-- Verificar que se crearon correctamente
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;
