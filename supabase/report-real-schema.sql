-- =============================================================================
-- REPORTE DE ESQUEMA REAL (Supabase) - Ejecutar en SQL Editor y copiar resultados
-- =============================================================================
-- Instrucciones: Ejecuta cada bloque por separado en Supabase → SQL Editor
-- y copia cada resultado en orden al reporte final.
-- =============================================================================

-- 1) TABLAS en schema public
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2) RUTINAS (funciones y procedimientos) en schema public
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 3) TRIGGERS en schema public
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4) FUNCIONES (pg_proc) en schema public
SELECT n.nspname AS schema, p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 5) COLUMNAS de user_budgets (confirmar income_amount)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_budgets'
ORDER BY ordinal_position;

-- 6) ENUMS (tipos enumerados)
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e'
ORDER BY t.typname, e.enumsortorder;
