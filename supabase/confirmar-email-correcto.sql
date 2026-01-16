-- Confirmar email del usuario (VERSIÓN CORRECTA)
-- Ejecuta esto en Supabase SQL Editor

-- Confirmar email del usuario
-- confirmed_at es una columna generada, solo actualizamos email_confirmed_at
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'gonzalomail@me.com';

-- Verificar que se actualizó
SELECT 
    id,
    email,
    email_confirmed_at,
    confirmed_at,  -- Esta es generada, se actualiza automáticamente
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Email confirmado'
        ELSE '❌ Email NO confirmado'
    END as status
FROM auth.users
WHERE email = 'gonzalomail@me.com';
