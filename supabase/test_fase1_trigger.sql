-- =============================================================================
-- Prueba funcional controlada: migración FASE 1 — trigger update_entity_budget_spent()
-- Objetivo: validar que spent_amount se actualiza al insertar una transacción.
-- Ejecutar en Supabase SQL Editor (con usuario autenticado o ver nota abajo).
-- No elimina datos existentes. Solo inserta registros de prueba con nombre TEST.
-- =============================================================================

DO $$
DECLARE
  v_user_id     UUID;
  v_family_id   INTEGER;
  v_category_id UUID;
  v_entity_id   UUID;
  v_allocation_id UUID;
BEGIN
  -- 1) Obtener usuario y familia (cualquier usuario con familia)
  SELECT id INTO v_user_id
  FROM public.users
  WHERE family_id IS NOT NULL
  LIMIT 1;

  v_family_id := public.get_user_family_id(v_user_id);
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene family_id. Asigna al usuario a una familia antes de ejecutar.';
  END IF;

  -- 2) Insertar categoría, entidad y asignación de prueba
  INSERT INTO public.budget_categories (family_id, name, type)
  VALUES (v_family_id, 'Ropa Test', 'GLOBAL')
  RETURNING id INTO v_category_id;

  INSERT INTO public.budget_entities (family_id, name, type)
  VALUES (v_family_id, 'Entidad Test', 'PERSON')
  RETURNING id INTO v_entity_id;

  INSERT INTO public.entity_budget_allocations (family_id, entity_id, category_id, monthly_limit)
  VALUES (v_family_id, v_entity_id, v_category_id, 5000)
  RETURNING id INTO v_allocation_id;

  -- 3) Insertar transacción de gasto (debe disparar el trigger)
  INSERT INTO public.transactions (
    user_id,
    amount,
    transaction_type,
    date,
    budget_entity_id,
    budget_category_id
  )
  VALUES (
    v_user_id,
    1000,
    'expense',
    now(),
    v_entity_id,
    v_category_id
  );

  RAISE NOTICE 'OK: Categoría %, Entidad %, Asignación %. Transacción insertada (1000 expense).', v_category_id, v_entity_id, v_allocation_id;
END $$;

-- 4) Verificación: spent_amount actualizado y remaining correcto
SELECT
  eba.id AS allocation_id,
  bc.name AS category_name,
  be.name AS entity_name,
  eba.monthly_limit,
  eba.spent_amount,
  (eba.monthly_limit - COALESCE(eba.spent_amount, 0)) AS remaining
FROM public.entity_budget_allocations eba
JOIN public.budget_categories bc ON bc.id = eba.category_id
JOIN public.budget_entities be ON be.id = eba.entity_id
WHERE bc.name = 'Ropa Test'
  AND be.name = 'Entidad Test'
  AND eba.family_id = (
    SELECT family_id FROM public.users
    WHERE family_id IS NOT NULL
    LIMIT 1
  )
ORDER BY eba.created_at DESC
LIMIT 1;

-- Esperado: monthly_limit = 5000, spent_amount = 1000, remaining = 4000
