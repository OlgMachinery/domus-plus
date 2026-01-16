-- Fix RLS Policies para permitir registro de usuarios
-- Ejecuta este SQL en Supabase SQL Editor

-- Política: Permitir INSERT en users durante el registro
-- Los usuarios pueden insertar su propio registro cuando se registran
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Si la política ya existe, elimínala primero con:
-- DROP POLICY IF EXISTS "Users can insert own data" ON users;
