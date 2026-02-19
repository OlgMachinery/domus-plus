-- Poblar modelo presupuestal FASE 1 con datos reales. No elimina datos existentes.
-- Ejecutar en Supabase SQL Editor.

DO $$
DECLARE
  v_user_id    UUID;
  v_family_id  INTEGER;
  v_gonzalo_id UUID;
  v_casa_id    UUID;
  v_auto_id    UUID;
  v_super_id   UUID;
  v_ropa_id    UUID;
  v_alim_id    UUID;
  v_gas_id     UUID;
  v_mant_id    UUID;
  v_serv_id    UUID;
BEGIN
  SELECT id, family_id INTO v_user_id, v_family_id
  FROM public.users
  WHERE family_id IS NOT NULL
  LIMIT 1;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'No hay usuario con family_id. Asigna una familia antes de ejecutar.';
  END IF;

  -- Entidades (crear si no existen)
  SELECT id INTO v_gonzalo_id FROM public.budget_entities WHERE family_id = v_family_id AND name = 'Gonzalo' LIMIT 1;
  IF v_gonzalo_id IS NULL THEN
    INSERT INTO public.budget_entities (family_id, name, type) VALUES (v_family_id, 'Gonzalo', 'PERSON') RETURNING id INTO v_gonzalo_id;
  END IF;

  SELECT id INTO v_casa_id FROM public.budget_entities WHERE family_id = v_family_id AND name = 'Casa' LIMIT 1;
  IF v_casa_id IS NULL THEN
    INSERT INTO public.budget_entities (family_id, name, type) VALUES (v_family_id, 'Casa', 'PROPERTY') RETURNING id INTO v_casa_id;
  END IF;

  SELECT id INTO v_auto_id FROM public.budget_entities WHERE family_id = v_family_id AND name = 'Auto' LIMIT 1;
  IF v_auto_id IS NULL THEN
    INSERT INTO public.budget_entities (family_id, name, type) VALUES (v_family_id, 'Auto', 'VEHICLE') RETURNING id INTO v_auto_id;
  END IF;

  SELECT id INTO v_super_id FROM public.budget_entities WHERE family_id = v_family_id AND name = 'Super' LIMIT 1;
  IF v_super_id IS NULL THEN
    INSERT INTO public.budget_entities (family_id, name, type) VALUES (v_family_id, 'Super', 'GROUP') RETURNING id INTO v_super_id;
  END IF;

  -- Categorías (crear si no existen)
  SELECT id INTO v_ropa_id FROM public.budget_categories WHERE family_id = v_family_id AND name = 'Ropa' LIMIT 1;
  IF v_ropa_id IS NULL THEN
    INSERT INTO public.budget_categories (family_id, name, type) VALUES (v_family_id, 'Ropa', 'GLOBAL') RETURNING id INTO v_ropa_id;
  END IF;

  SELECT id INTO v_alim_id FROM public.budget_categories WHERE family_id = v_family_id AND name = 'Alimentación' LIMIT 1;
  IF v_alim_id IS NULL THEN
    INSERT INTO public.budget_categories (family_id, name, type) VALUES (v_family_id, 'Alimentación', 'GLOBAL') RETURNING id INTO v_alim_id;
  END IF;

  SELECT id INTO v_gas_id FROM public.budget_categories WHERE family_id = v_family_id AND name = 'Gasolina' LIMIT 1;
  IF v_gas_id IS NULL THEN
    INSERT INTO public.budget_categories (family_id, name, type) VALUES (v_family_id, 'Gasolina', 'GLOBAL') RETURNING id INTO v_gas_id;
  END IF;

  SELECT id INTO v_mant_id FROM public.budget_categories WHERE family_id = v_family_id AND name = 'Mantenimiento' LIMIT 1;
  IF v_mant_id IS NULL THEN
    INSERT INTO public.budget_categories (family_id, name, type) VALUES (v_family_id, 'Mantenimiento', 'GLOBAL') RETURNING id INTO v_mant_id;
  END IF;

  SELECT id INTO v_serv_id FROM public.budget_categories WHERE family_id = v_family_id AND name = 'Servicios' LIMIT 1;
  IF v_serv_id IS NULL THEN
    INSERT INTO public.budget_categories (family_id, name, type) VALUES (v_family_id, 'Servicios', 'GLOBAL') RETURNING id INTO v_serv_id;
  END IF;

  -- Asignaciones (sin duplicar)
  INSERT INTO public.entity_budget_allocations (family_id, entity_id, category_id, monthly_limit)
  VALUES (v_family_id, v_gonzalo_id, v_ropa_id, 3000)
  ON CONFLICT (family_id, entity_id, category_id) DO NOTHING;

  INSERT INTO public.entity_budget_allocations (family_id, entity_id, category_id, monthly_limit)
  VALUES (v_family_id, v_casa_id, v_serv_id, 8000)
  ON CONFLICT (family_id, entity_id, category_id) DO NOTHING;

  INSERT INTO public.entity_budget_allocations (family_id, entity_id, category_id, monthly_limit)
  VALUES (v_family_id, v_auto_id, v_gas_id, 4000)
  ON CONFLICT (family_id, entity_id, category_id) DO NOTHING;

  INSERT INTO public.entity_budget_allocations (family_id, entity_id, category_id, monthly_limit)
  VALUES (v_family_id, v_auto_id, v_mant_id, 2000)
  ON CONFLICT (family_id, entity_id, category_id) DO NOTHING;

  INSERT INTO public.entity_budget_allocations (family_id, entity_id, category_id, monthly_limit)
  VALUES (v_family_id, v_super_id, v_alim_id, 12000)
  ON CONFLICT (family_id, entity_id, category_id) DO NOTHING;

  -- Transacciones de prueba (expense)
  INSERT INTO public.transactions (user_id, amount, transaction_type, date, budget_entity_id, budget_category_id)
  VALUES (v_user_id, 1200, 'expense', now(), v_gonzalo_id, v_ropa_id);

  INSERT INTO public.transactions (user_id, amount, transaction_type, date, budget_entity_id, budget_category_id)
  VALUES (v_user_id, 3500, 'expense', now(), v_super_id, v_alim_id);

  INSERT INTO public.transactions (user_id, amount, transaction_type, date, budget_entity_id, budget_category_id)
  VALUES (v_user_id, 1500, 'expense', now(), v_auto_id, v_gas_id);

  INSERT INTO public.transactions (user_id, amount, transaction_type, date, budget_entity_id, budget_category_id)
  VALUES (v_user_id, 2000, 'expense', now(), v_casa_id, v_serv_id);

  RAISE NOTICE 'Seed FASE 1 OK: family_id %, 4 entidades, 5 categorías, 5 asignaciones, 4 transacciones.', v_family_id;
END $$;
