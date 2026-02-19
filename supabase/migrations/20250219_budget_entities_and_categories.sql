-- =============================================================================
-- DOMUS+ — FASE 1: Modelo presupuestal (solo migración)
-- Contenido: helper get_user_family_id | nuevas tablas | alter transactions
--            | función trigger | trigger | RLS nuevas tablas | grants
-- NO duplica schema base. Ejecutar en Supabase cuando validado.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Helper RLS: get_user_family_id (si no existe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_family_id(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id INTEGER;
BEGIN
  SELECT family_id INTO v_family_id
  FROM public.users
  WHERE id = p_user_id;
  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_family_id(UUID) TO anon;

-- -----------------------------------------------------------------------------
-- Nuevas tablas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id INTEGER NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('GLOBAL','PERSONAL','ASSET')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_categories_family_id ON public.budget_categories(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_is_active ON public.budget_categories(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.budget_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id INTEGER NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PERSON','VEHICLE','PROPERTY','GROUP')),
    owner_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_entities_family_id ON public.budget_entities(family_id);
CREATE INDEX IF NOT EXISTS idx_budget_entities_owner ON public.budget_entities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_budget_entities_is_active ON public.budget_entities(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.entity_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id INTEGER NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES public.budget_entities(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
    monthly_limit NUMERIC NOT NULL DEFAULT 0,
    spent_amount NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(family_id, entity_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_budget_allocations_family ON public.entity_budget_allocations(family_id);
CREATE INDEX IF NOT EXISTS idx_entity_budget_allocations_entity ON public.entity_budget_allocations(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_budget_allocations_category ON public.entity_budget_allocations(category_id);
CREATE INDEX IF NOT EXISTS idx_entity_budget_allocations_active ON public.entity_budget_allocations(is_active) WHERE is_active = true;

-- -----------------------------------------------------------------------------
-- Alter transactions (columnas para linkear gasto a entidad/categoría)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'budget_entity_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN budget_entity_id UUID NULL;
        ALTER TABLE public.transactions
            ADD CONSTRAINT fk_transactions_budget_entity
            FOREIGN KEY (budget_entity_id) REFERENCES public.budget_entities(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'budget_category_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN budget_category_id UUID NULL;
        ALTER TABLE public.transactions
            ADD CONSTRAINT fk_transactions_budget_category
            FOREIGN KEY (budget_category_id) REFERENCES public.budget_categories(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_budget_entity_id ON public.transactions(budget_entity_id) WHERE budget_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_budget_category_id ON public.transactions(budget_category_id) WHERE budget_category_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Función trigger: update_entity_budget_spent()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_entity_budget_spent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.budget_entity_id IS NOT NULL AND OLD.budget_category_id IS NOT NULL
           AND (OLD.transaction_type = 'expense') THEN
            UPDATE public.entity_budget_allocations eba
            SET spent_amount = COALESCE(
                (SELECT SUM(t.amount)::NUMERIC
                 FROM public.transactions t
                 WHERE t.budget_entity_id = eba.entity_id
                   AND t.budget_category_id = eba.category_id
                   AND t.transaction_type = 'expense'
                   AND date_trunc('month', t.date AT TIME ZONE 'UTC') = date_trunc('month', (now() AT TIME ZONE 'UTC'))),
                0)
            WHERE eba.family_id = (
                SELECT family_id FROM public.users WHERE id = OLD.user_id
            )
            AND eba.entity_id = OLD.budget_entity_id
            AND eba.category_id = OLD.budget_category_id;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.budget_entity_id IS NOT NULL AND NEW.budget_category_id IS NOT NULL
           AND (NEW.transaction_type = 'expense') THEN
            UPDATE public.entity_budget_allocations eba
            SET spent_amount = COALESCE(
                (SELECT SUM(t.amount)::NUMERIC
                 FROM public.transactions t
                 WHERE t.budget_entity_id = eba.entity_id
                   AND t.budget_category_id = eba.category_id
                   AND t.transaction_type = 'expense'
                   AND date_trunc('month', t.date AT TIME ZONE 'UTC') = date_trunc('month', (now() AT TIME ZONE 'UTC'))),
                0)
            WHERE eba.family_id = (
                SELECT family_id FROM public.users WHERE id = NEW.user_id
            )
            AND eba.entity_id = NEW.budget_entity_id
            AND eba.category_id = NEW.budget_category_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.budget_entity_id IS NOT NULL AND OLD.budget_category_id IS NOT NULL
           AND (OLD.transaction_type = 'expense')
           AND ((OLD.budget_entity_id IS DISTINCT FROM NEW.budget_entity_id)
                OR (OLD.budget_category_id IS DISTINCT FROM NEW.budget_category_id)) THEN
            UPDATE public.entity_budget_allocations eba
            SET spent_amount = COALESCE(
                (SELECT SUM(t.amount)::NUMERIC
                 FROM public.transactions t
                 WHERE t.budget_entity_id = eba.entity_id
                   AND t.budget_category_id = eba.category_id
                   AND t.transaction_type = 'expense'
                   AND date_trunc('month', t.date AT TIME ZONE 'UTC') = date_trunc('month', (now() AT TIME ZONE 'UTC'))),
                0)
            WHERE eba.family_id = (
                SELECT family_id FROM public.users WHERE id = OLD.user_id
            )
            AND eba.entity_id = OLD.budget_entity_id
            AND eba.category_id = OLD.budget_category_id;
        END IF;
        IF NEW.budget_entity_id IS NOT NULL AND NEW.budget_category_id IS NOT NULL
           AND (NEW.transaction_type = 'expense') THEN
            UPDATE public.entity_budget_allocations eba
            SET spent_amount = COALESCE(
                (SELECT SUM(t.amount)::NUMERIC
                 FROM public.transactions t
                 WHERE t.budget_entity_id = eba.entity_id
                   AND t.budget_category_id = eba.category_id
                   AND t.transaction_type = 'expense'
                   AND date_trunc('month', t.date AT TIME ZONE 'UTC') = date_trunc('month', (now() AT TIME ZONE 'UTC'))),
                0)
            WHERE eba.family_id = (
                SELECT family_id FROM public.users WHERE id = NEW.user_id
            )
            AND eba.entity_id = NEW.budget_entity_id
            AND eba.category_id = NEW.budget_category_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- -----------------------------------------------------------------------------
-- Trigger
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_entity_budget_spent_trigger ON public.transactions;
CREATE TRIGGER update_entity_budget_spent_trigger
    AFTER INSERT OR UPDATE OF amount, date, budget_entity_id, budget_category_id, transaction_type OR DELETE
    ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_entity_budget_spent();

-- -----------------------------------------------------------------------------
-- RLS nuevas tablas
-- -----------------------------------------------------------------------------
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_budget_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family members can view budget_categories" ON public.budget_categories;
CREATE POLICY "Family members can view budget_categories" ON public.budget_categories
    FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));

DROP POLICY IF EXISTS "Family members can manage budget_categories" ON public.budget_categories;
CREATE POLICY "Family members can manage budget_categories" ON public.budget_categories
    FOR ALL USING (family_id = public.get_user_family_id(auth.uid()))
    WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

DROP POLICY IF EXISTS "Family members can view budget_entities" ON public.budget_entities;
CREATE POLICY "Family members can view budget_entities" ON public.budget_entities
    FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));

DROP POLICY IF EXISTS "Family members can manage budget_entities" ON public.budget_entities;
CREATE POLICY "Family members can manage budget_entities" ON public.budget_entities
    FOR ALL USING (family_id = public.get_user_family_id(auth.uid()))
    WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

DROP POLICY IF EXISTS "Family members can view entity_budget_allocations" ON public.entity_budget_allocations;
CREATE POLICY "Family members can view entity_budget_allocations" ON public.entity_budget_allocations
    FOR SELECT USING (family_id = public.get_user_family_id(auth.uid()));

DROP POLICY IF EXISTS "Family members can manage entity_budget_allocations" ON public.entity_budget_allocations;
CREATE POLICY "Family members can manage entity_budget_allocations" ON public.entity_budget_allocations
    FOR ALL USING (family_id = public.get_user_family_id(auth.uid()))
    WITH CHECK (family_id = public.get_user_family_id(auth.uid()));

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_entities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_budget_allocations TO authenticated;
