-- 🔒 POLÍTICAS RLS PARA RECIBOS
-- Ejecuta esto en Supabase SQL Editor si las políticas no existen
-- Esto permite que los usuarios puedan crear y ver sus propios recibos

-- Eliminar políticas existentes si hay conflictos (idempotente)
DROP POLICY IF EXISTS "Users can insert own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can view own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON receipts;
DROP POLICY IF EXISTS "Users can insert own receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Users can view own receipt items" ON receipt_items;
DROP POLICY IF EXISTS "Users can update own receipt items" ON receipt_items;

-- Política: Los usuarios pueden INSERTAR sus propios recibos
CREATE POLICY "Users can insert own receipts" ON receipts
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden VER sus propios recibos
CREATE POLICY "Users can view own receipts" ON receipts
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Política: Los usuarios pueden ACTUALIZAR sus propios recibos
CREATE POLICY "Users can update own receipts" ON receipts
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Política: Los usuarios pueden INSERTAR items de sus recibos
CREATE POLICY "Users can insert own receipt items" ON receipt_items
    FOR INSERT 
    WITH CHECK (
        receipt_id IN (
            SELECT id FROM receipts WHERE user_id = auth.uid()
        )
    );

-- Política: Los usuarios pueden VER items de sus recibos
CREATE POLICY "Users can view own receipt items" ON receipt_items
    FOR SELECT 
    USING (
        receipt_id IN (
            SELECT id FROM receipts WHERE user_id = auth.uid()
        )
    );

-- Política: Los usuarios pueden ACTUALIZAR items de sus recibos
CREATE POLICY "Users can update own receipt items" ON receipt_items
    FOR UPDATE 
    USING (
        receipt_id IN (
            SELECT id FROM receipts WHERE user_id = auth.uid()
        )
    );

-- Verificar políticas creadas
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
WHERE tablename IN ('receipts', 'receipt_items')
ORDER BY tablename, policyname;
