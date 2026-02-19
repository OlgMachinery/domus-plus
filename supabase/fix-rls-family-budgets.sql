-- Solución: Políticas RLS para permitir INSERT y UPDATE en family_budgets
-- Ejecuta esto en Supabase SQL Editor

-- Eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Users can insert family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can update family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can insert budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can update budgets" ON family_budgets;

-- Política: Los administradores de familia pueden INSERTAR presupuestos
CREATE POLICY "Family admins can insert budgets" ON family_budgets
    FOR INSERT 
    WITH CHECK (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden ACTUALIZAR presupuestos
CREATE POLICY "Family admins can update budgets" ON family_budgets
    FOR UPDATE 
    USING (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    )
    WITH CHECK (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden ELIMINAR presupuestos
CREATE POLICY "Family admins can delete budgets" ON family_budgets
    FOR DELETE 
    USING (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Verificar que se crearon correctamente
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;
