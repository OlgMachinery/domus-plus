-- =============================================================================
-- Sincronizar columnas de public.users (proyecto que no se creó desde cero en Supabase)
-- Ejecuta esto en Supabase SQL Editor si falla "Could not find the 'can_create_events' column".
-- Añade solo las columnas que falten; no borra datos.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_register_expenses') THEN
    ALTER TABLE public.users ADD COLUMN can_register_expenses BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_upload_receipts') THEN
    ALTER TABLE public.users ADD COLUMN can_upload_receipts BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_create_events') THEN
    ALTER TABLE public.users ADD COLUMN can_create_events BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_view_global_summary') THEN
    ALTER TABLE public.users ADD COLUMN can_view_global_summary BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
  AND column_name IN ('can_register_expenses', 'can_upload_receipts', 'can_create_events', 'can_view_global_summary')
ORDER BY column_name;
