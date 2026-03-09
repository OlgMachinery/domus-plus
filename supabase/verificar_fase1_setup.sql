-- =============================================================================
-- DOMUS+ — Verificación Fase 1 Setup Wizard
-- Ejecutar en Supabase > SQL Editor. Comprueba columnas, tipos, función y RLS.
-- Si algo falla, aplicar antes: 20250219_budget_entities_and_categories.sql
--                             20250220_setup_wizard_fase1.sql
-- =============================================================================

DO $$
DECLARE
  v_ok BOOLEAN := true;
  v_msg TEXT := '';
BEGIN
  -- 1. Columnas en families
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'currency') THEN
    v_ok := false; v_msg := v_msg || 'families.currency falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'cutoff_day') THEN
    v_ok := false; v_msg := v_msg || 'families.cutoff_day falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'budget_start_date') THEN
    v_ok := false; v_msg := v_msg || 'families.budget_start_date falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'setup_complete') THEN
    v_ok := false; v_msg := v_msg || 'families.setup_complete falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'plan_status') THEN
    v_ok := false; v_msg := v_msg || 'families.plan_status falta. ';
  END IF;

  -- 2. Columnas en users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_register_expenses') THEN
    v_ok := false; v_msg := v_msg || 'users.can_register_expenses falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_upload_receipts') THEN
    v_ok := false; v_msg := v_msg || 'users.can_upload_receipts falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_create_events') THEN
    v_ok := false; v_msg := v_msg || 'users.can_create_events falta. ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_view_global_summary') THEN
    v_ok := false; v_msg := v_msg || 'users.can_view_global_summary falta. ';
  END IF;

  -- 3. Tablas del modelo (deben existir por 20250219)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_entities') THEN
    v_ok := false; v_msg := v_msg || 'Tabla budget_entities falta (ejecutar 20250219). ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_categories') THEN
    v_ok := false; v_msg := v_msg || 'Tabla budget_categories falta (ejecutar 20250219). ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'entity_budget_allocations') THEN
    v_ok := false; v_msg := v_msg || 'Tabla entity_budget_allocations falta (ejecutar 20250219). ';
  END IF;

  -- 4. budget_categories acepta FAMILY (constraint debe permitir GLOBAL,PERSONAL,ASSET,FAMILY)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_categories') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE n.nspname = 'public' AND t.relname = 'budget_categories'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%FAMILY%'
    ) THEN
      v_ok := false; v_msg := v_msg || 'budget_categories.type debe incluir FAMILY (ejecutar 20250220). ';
    END IF;
  END IF;

  -- 5. Función can_set_setup_complete
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'can_set_setup_complete') THEN
    v_ok := false; v_msg := v_msg || 'Función can_set_setup_complete falta (ejecutar 20250220). ';
  END IF;

  -- 6. get_user_family_id
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_user_family_id') THEN
    v_ok := false; v_msg := v_msg || 'Función get_user_family_id falta (ejecutar 20250219). ';
  END IF;

  -- 7. RLS activo en budget_entities
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budget_entities') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = 'budget_entities' AND c.relrowsecurity = true) THEN
      v_ok := false; v_msg := v_msg || 'RLS no activo en budget_entities. ';
    END IF;
  END IF;

  IF v_ok THEN
    RAISE NOTICE 'OK Fase 1: familias, users, budget_categories (FAMILY), can_set_setup_complete y RLS verificados.';
  ELSE
    RAISE WARNING 'Fase 1 incompleto: %', v_msg;
  END IF;
END $$;

-- Resumen legible
SELECT 'families' AS objeto, column_name AS detalle
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'families'
AND column_name IN ('currency','cutoff_day','budget_start_date','setup_complete','plan_status')
UNION ALL
SELECT 'users', column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
AND column_name IN ('can_register_expenses','can_upload_receipts','can_create_events','can_view_global_summary')
UNION ALL
SELECT 'funciones', proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname IN ('get_user_family_id','is_family_admin','can_set_setup_complete')
ORDER BY objeto, detalle;
