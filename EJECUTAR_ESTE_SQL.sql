-- ⚠️ EJECUTA ESTE SQL EN SUPABASE AHORA
-- Copia y pega esto en SQL Editor → New Query → Run

-- Política: Permitir INSERT en users durante el registro
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- ✅ Después de ejecutar esto, vuelve a intentar registrarte
