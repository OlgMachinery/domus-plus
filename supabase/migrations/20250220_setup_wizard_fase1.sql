-- =============================================================================
-- DOMUS+ — Fase 1: Setup Wizard (Task Spec raíz → tronco)
-- Añade: families (currency, cutoff_day, budget_start_date, setup_complete, plan_status)
--        users (permisos integrantes)
--        budget_categories tipo FAMILY
--        RLS: solo Admin puede crear/editar/eliminar entidades, categorías y plan
-- NO modifica trigger ni transacciones. No activa switch.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Families: columnas para setup y plan
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'currency') THEN
    ALTER TABLE public.families ADD COLUMN currency VARCHAR(3) DEFAULT 'MXN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'cutoff_day') THEN
    ALTER TABLE public.families ADD COLUMN cutoff_day INTEGER DEFAULT 1 CHECK (cutoff_day >= 1 AND cutoff_day <= 31);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'budget_start_date') THEN
    ALTER TABLE public.families ADD COLUMN budget_start_date DATE DEFAULT (date_trunc('month', CURRENT_DATE)::date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'setup_complete') THEN
    ALTER TABLE public.families ADD COLUMN setup_complete BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'plan_status') THEN
    ALTER TABLE public.families ADD COLUMN plan_status TEXT DEFAULT 'DRAFT' CHECK (plan_status IN ('DRAFT', 'CONFIRMED'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Users: permisos de integrantes (Paso 2 del wizard)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. budget_categories: añadir tipo FAMILY
-- -----------------------------------------------------------------------------
ALTER TABLE public.budget_categories DROP CONSTRAINT IF EXISTS budget_categories_type_check;
ALTER TABLE public.budget_categories ADD CONSTRAINT budget_categories_type_check
  CHECK (type IN ('GLOBAL', 'PERSONAL', 'ASSET', 'FAMILY'));

-- -----------------------------------------------------------------------------
-- 4. Función is_family_admin (si no existe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_family_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_family_admin INTO v_is_admin
  FROM public.users
  WHERE id = p_user_id;
  RETURN COALESCE(v_is_admin, false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID) TO anon;

-- -----------------------------------------------------------------------------
-- 5. Validación setup_complete (solo true si todas las condiciones)
-- Uso: llamar antes de UPDATE families SET setup_complete = true
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_set_setup_complete(p_family_id INTEGER)
RETURNS TABLE(ok BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_person BOOLEAN;
  v_has_group BOOLEAN;
  v_has_categories BOOLEAN;
  v_has_allocation_positive BOOLEAN;
  v_plan_confirmed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM budget_entities
    WHERE family_id = p_family_id AND type = 'PERSON' AND is_active = true
  ) INTO v_has_person;
  IF NOT v_has_person THEN
    RETURN QUERY SELECT false, 'Debe existir al menos una entidad tipo PERSON activa'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM budget_entities
    WHERE family_id = p_family_id AND type = 'GROUP' AND is_active = true
  ) INTO v_has_group;
  IF NOT v_has_group THEN
    RETURN QUERY SELECT false, 'Debe existir al menos una entidad tipo GROUP activa'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM budget_categories
    WHERE family_id = p_family_id AND is_active = true
  ) INTO v_has_categories;
  IF NOT v_has_categories THEN
    RETURN QUERY SELECT false, 'Deben existir categorías activas'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM entity_budget_allocations eba
    WHERE eba.family_id = p_family_id AND eba.is_active = true AND eba.monthly_limit > 0
  ) INTO v_has_allocation_positive;
  IF NOT v_has_allocation_positive THEN
    RETURN QUERY SELECT false, 'Debe existir al menos una asignación con monto > 0'::TEXT;
    RETURN;
  END IF;

  SELECT (plan_status = 'CONFIRMED') INTO v_plan_confirmed
  FROM families WHERE id = p_family_id;
  IF NOT v_plan_confirmed THEN
    RETURN QUERY SELECT false, 'El plan debe estar confirmado explícitamente'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.can_set_setup_complete(INTEGER) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. RLS: solo Admin puede INSERT/UPDATE/DELETE en entidades, categorías, allocations
-- -----------------------------------------------------------------------------
ALTER TABLE public.budget_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_budget_allocations ENABLE ROW LEVEL SECURITY;

-- budget_entities
DROP POLICY IF EXISTS "Family members can manage budget_entities" ON public.budget_entities;
CREATE POLICY "Admin can manage budget_entities" ON public.budget_entities
  FOR ALL
  USING (
    family_id = public.get_user_family_id(auth.uid())
    AND public.is_family_admin(auth.uid()) = true
  )
  WITH CHECK (
    family_id = public.get_user_family_id(auth.uid())
    AND public.is_family_admin(auth.uid()) = true
  );

-- budget_categories
DROP POLICY IF EXISTS "Family members can manage budget_categories" ON public.budget_categories;
CREATE POLICY "Admin can manage budget_categories" ON public.budget_categories
  FOR ALL
  USING (
    family_id = public.get_user_family_id(auth.uid())
    AND public.is_family_admin(auth.uid()) = true
  )
  WITH CHECK (
    family_id = public.get_user_family_id(auth.uid())
    AND public.is_family_admin(auth.uid()) = true
  );

-- entity_budget_allocations
DROP POLICY IF EXISTS "Family members can manage entity_budget_allocations" ON public.entity_budget_allocations;
CREATE POLICY "Admin can manage entity_budget_allocations" ON public.entity_budget_allocations
  FOR ALL
  USING (
    family_id = public.get_user_family_id(auth.uid())
    AND public.is_family_admin(auth.uid()) = true
  )
  WITH CHECK (
    family_id = public.get_user_family_id(auth.uid())
    AND public.is_family_admin(auth.uid()) = true
  );
