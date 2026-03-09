-- Añadir ciudad y pertenencia a familia para registro (Twilio y flujo de invitación)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city VARCHAR(120),
  ADD COLUMN IF NOT EXISTS belongs_to_family BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN users.city IS 'Ciudad del usuario (registro)';
COMMENT ON COLUMN users.belongs_to_family IS 'Indica si el usuario pertenece o espera pertenecer a una familia (registro)';
