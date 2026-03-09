-- Permite crear y editar categorías personalizadas a usuarios de la familia.
-- Ejecutar UNA VEZ en Supabase: SQL Editor → pegar y Run.

-- custom_categories: INSERT, UPDATE, DELETE (SELECT ya existe en schema)
DROP POLICY IF EXISTS "Users can insert family custom categories" ON custom_categories;
CREATE POLICY "Users can insert family custom categories" ON custom_categories
  FOR INSERT WITH CHECK (
    family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update family custom categories" ON custom_categories;
CREATE POLICY "Users can update family custom categories" ON custom_categories
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete family custom categories" ON custom_categories;
CREATE POLICY "Users can delete family custom categories" ON custom_categories
  FOR DELETE USING (
    family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- custom_subcategories: SELECT/INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Users can view family custom subcategories" ON custom_subcategories;
CREATE POLICY "Users can view family custom subcategories" ON custom_subcategories
  FOR SELECT USING (
    custom_category_id IN (
      SELECT id FROM custom_categories
      WHERE family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert family custom subcategories" ON custom_subcategories;
CREATE POLICY "Users can insert family custom subcategories" ON custom_subcategories
  FOR INSERT WITH CHECK (
    custom_category_id IN (
      SELECT id FROM custom_categories
      WHERE family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update family custom subcategories" ON custom_subcategories;
CREATE POLICY "Users can update family custom subcategories" ON custom_subcategories
  FOR UPDATE USING (
    custom_category_id IN (
      SELECT id FROM custom_categories
      WHERE family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete family custom subcategories" ON custom_subcategories;
CREATE POLICY "Users can delete family custom subcategories" ON custom_subcategories
  FOR DELETE USING (
    custom_category_id IN (
      SELECT id FROM custom_categories
      WHERE family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
    )
  );
