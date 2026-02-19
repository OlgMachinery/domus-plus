-- Funciones SQL para lógica compleja de presupuestos
-- Ejecuta esto en Supabase SQL Editor

-- ============================================
-- FUNCIÓN: Obtener presupuestos familiares con cálculos
-- ============================================
CREATE OR REPLACE FUNCTION public.get_family_budgets_with_calculations(
  p_family_id INTEGER,
  p_year INTEGER DEFAULT NULL
)
RETURNS TABLE(
  id INTEGER,
  family_id INTEGER,
  category VARCHAR,
  subcategory VARCHAR,
  custom_category_id INTEGER,
  custom_subcategory_id INTEGER,
  year INTEGER,
  total_amount FLOAT,
  monthly_amounts JSONB,
  display_names JSONB,
  due_date TIMESTAMPTZ,
  payment_status VARCHAR,
  notes TEXT,
  budget_type VARCHAR,
  distribution_method VARCHAR,
  auto_distribute BOOLEAN,
  target_user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_allocations JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
BEGIN
  -- Año por defecto: año actual
  IF p_year IS NULL THEN
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  ELSE
    v_year := p_year;
  END IF;

  RETURN QUERY
  SELECT 
    fb.id,
    fb.family_id,
    fb.category,
    fb.subcategory,
    fb.custom_category_id,
    fb.custom_subcategory_id,
    fb.year,
    fb.total_amount,
    fb.monthly_amounts,
    fb.display_names,
    fb.due_date,
    fb.payment_status,
    fb.notes,
    fb.budget_type,
    fb.distribution_method,
    fb.auto_distribute,
    fb.target_user_id,
    fb.created_at,
    fb.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ub.id,
            'user_id', ub.user_id,
            'family_budget_id', ub.family_budget_id,
            'allocated_amount', ub.allocated_amount,
            'spent_amount', COALESCE(ub.spent_amount, 0),
            'income_amount', COALESCE(
              (
                SELECT COALESCE(SUM(t.amount), 0)
                FROM transactions t
                WHERE t.family_budget_id = fb.id
                  AND t.user_id = ub.user_id
                  AND t.transaction_type = 'income'
              ),
              0
            ),
            'available_amount', ub.allocated_amount + COALESCE(
              (
                SELECT COALESCE(SUM(t.amount), 0)
                FROM transactions t
                WHERE t.family_budget_id = fb.id
                  AND t.user_id = ub.user_id
                  AND t.transaction_type = 'income'
              ),
              0
            ) - COALESCE(ub.spent_amount, 0)
          )
        )
        FROM user_budgets ub
        WHERE ub.family_budget_id = fb.id
      ),
      '[]'::jsonb
    ) as user_allocations
  FROM family_budgets fb
  WHERE fb.family_id = p_family_id
    AND fb.year = v_year
  ORDER BY fb.category, fb.subcategory;
END;
$$;

-- Dar permisos
GRANT EXECUTE ON FUNCTION public.get_family_budgets_with_calculations(INTEGER, INTEGER) TO authenticated;

-- ============================================
-- FUNCIÓN: Actualizar spent_amount e income_amount en user_budgets
-- ============================================
CREATE OR REPLACE FUNCTION public.update_user_budget_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar spent_amount e income_amount cuando se crea/actualiza una transacción
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Actualizar spent_amount para gastos
    IF NEW.transaction_type = 'expense' AND NEW.family_budget_id IS NOT NULL THEN
      UPDATE user_budgets
      SET spent_amount = COALESCE(
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM transactions
          WHERE family_budget_id = NEW.family_budget_id
            AND user_id = NEW.user_id
            AND transaction_type = 'expense'
        ),
        0
      )
      WHERE family_budget_id = NEW.family_budget_id
        AND user_id = NEW.user_id;
    END IF;

    -- Actualizar income_amount para ingresos
    IF NEW.transaction_type = 'income' AND NEW.family_budget_id IS NOT NULL THEN
      UPDATE user_budgets
      SET income_amount = COALESCE(
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM transactions
          WHERE family_budget_id = NEW.family_budget_id
            AND user_id = NEW.user_id
            AND transaction_type = 'income'
        ),
        0
      )
      WHERE family_budget_id = NEW.family_budget_id
        AND user_id = NEW.user_id;
    END IF;
  END IF;

  -- Si se elimina una transacción, recalcular
  IF TG_OP = 'DELETE' THEN
    IF OLD.family_budget_id IS NOT NULL THEN
      UPDATE user_budgets
      SET 
        spent_amount = COALESCE(
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM transactions
            WHERE family_budget_id = OLD.family_budget_id
              AND user_id = OLD.user_id
              AND transaction_type = 'expense'
          ),
          0
        ),
        income_amount = COALESCE(
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM transactions
            WHERE family_budget_id = OLD.family_budget_id
              AND user_id = OLD.user_id
              AND transaction_type = 'income'
          ),
          0
        )
      WHERE family_budget_id = OLD.family_budget_id
        AND user_id = OLD.user_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar automáticamente
DROP TRIGGER IF EXISTS update_user_budget_amounts_trigger ON transactions;
CREATE TRIGGER update_user_budget_amounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_budget_amounts();

-- Verificar que se crearon
SELECT proname, proargnames
FROM pg_proc
WHERE proname IN ('get_family_budgets_with_calculations', 'update_user_budget_amounts');
