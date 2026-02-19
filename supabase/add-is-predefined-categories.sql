-- Permite marcar categorías predefinidas (sembradas por sistema) para que se puedan editar como el resto
ALTER TABLE custom_categories
  ADD COLUMN IF NOT EXISTS is_predefined BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN custom_categories.is_predefined IS 'True si la categoría fue sembrada por el sistema (predefinida); todas son editables.';
