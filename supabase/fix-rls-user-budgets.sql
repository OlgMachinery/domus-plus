-- Solución: Políticas RLS para permitir INSERT y UPDATE en user_budgets
-- Ejecuta esto en Supabase SQL Editor

-- Eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Users can insert own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Users can update own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Family admins can insert user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Family admins can update user budgets" ON user_budgets;

-- Política: Los administradores de familia pueden INSERTAR presupuestos de usuario
CREATE POLICY "Family admins can insert user budgets" ON user_budgets
    FOR INSERT 
    WITH CHECK (
        user_id IN (
            SELECT id 
            FROM users 
            WHERE family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    );

-- Política: Los administradores de familia pueden ACTUALIZAR presupuestos de usuario
CREATE POLICY "Family admins can update user budgets" ON user_budgets
    FOR UPDATE 
    USING (
        user_id IN (
            SELECT id 
            FROM users 
            WHERE family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id 
            FROM users 
            WHERE family_id IN (
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
WHERE tablename = 'user_budgets'
ORDER BY cmd, policyname;
