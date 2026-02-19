-- Políticas RLS para roles: Admin puede crear cualquier presupuesto, Usuario solo individuales
-- Ejecuta esto en Supabase SQL Editor

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Family admins can insert budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can insert own individual budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can update budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can update own individual budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can delete budgets" ON family_budgets;

-- Política: Los administradores de familia pueden INSERTAR cualquier presupuesto
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

-- Política: Los usuarios normales pueden INSERTAR solo presupuestos individuales para ellos mismos
CREATE POLICY "Users can insert own individual budgets" ON family_budgets
    FOR INSERT 
    WITH CHECK (
        -- Debe ser presupuesto individual
        budget_type = 'individual' 
        AND target_user_id = auth.uid()
        AND family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid()
        )
        -- Y NO debe ser administrador (los admins usan la política anterior)
        AND NOT EXISTS (
            SELECT 1 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden ACTUALIZAR cualquier presupuesto
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

-- Política: Los usuarios normales pueden ACTUALIZAR solo sus presupuestos individuales
CREATE POLICY "Users can update own individual budgets" ON family_budgets
    FOR UPDATE 
    USING (
        budget_type = 'individual' 
        AND target_user_id = auth.uid()
        AND family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid()
        )
        AND NOT EXISTS (
            SELECT 1 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    )
    WITH CHECK (
        budget_type = 'individual' 
        AND target_user_id = auth.uid()
        AND family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid()
        )
        AND NOT EXISTS (
            SELECT 1 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden ELIMINAR cualquier presupuesto
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
