# 🔧 Solución Completa para el Login

## 🎯 Problema

El login muestra "Email o contraseña incorrectos" incluso después de confirmar el email.

## ✅ Solución: Script SQL Completo

He creado un script SQL que:
1. ✅ Verifica el estado actual del usuario
2. ✅ Confirma el email
3. ✅ Crea/actualiza el usuario en la tabla `users`
4. ✅ Verifica que todo esté correcto

### Ejecuta este SQL en Supabase:

El archivo está en: `supabase/fix-usuario-completo.sql`

O copia y pega directamente:

```sql
-- 1. Confirmar email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'gonzalomail@me.com';

-- 2. Crear/actualizar usuario en tabla users
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'name', 'Gonzalo Montaño'),
    COALESCE(raw_user_meta_data->>'phone', '+526865690472'),
    true,
    false
FROM auth.users
WHERE email = 'gonzalomail@me.com'
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), users.phone),
    is_active = true;
```

## 🧪 Después de Ejecutar el SQL

1. **Ejecuta el SQL** en Supabase SQL Editor
2. **Verifica** que ambos queries muestren el usuario
3. **Intenta iniciar sesión** de nuevo:
   - Email: `gonzalomail@me.com`
   - Contraseña: La que usaste al registrarte

## 🔍 Si Aún No Funciona

### Verificar Contraseña

Si no recuerdas la contraseña o no funciona:

1. **Opción A: Resetear contraseña en Supabase**
   - Ve a: **Authentication** → **Users**
   - Busca: `gonzalomail@me.com`
   - Clic en el usuario
   - Puedes resetear la contraseña desde ahí

2. **Opción B: Registrar de nuevo**
   - Elimina el usuario en Supabase
   - Regístrate de nuevo con una contraseña que recuerdes
   - Confirma el email con el SQL

### Verificar en Consola del Navegador

Abre la consola del navegador (F12) y revisa los logs cuando intentas iniciar sesión. Deberías ver:
- `🔐 Intentando login con Supabase...`
- Si hay error: `❌ Error de autenticación: ...`

## ✅ Checklist

- [ ] Email confirmado en `auth.users`
- [ ] Usuario existe en tabla `users`
- [ ] `is_active = true` en tabla `users`
- [ ] IDs coinciden entre `auth.users` y `users`
- [ ] Contraseña es correcta

## 🚀 Próximos Pasos

1. Ejecuta el SQL completo
2. Verifica que todo esté correcto
3. Intenta iniciar sesión
4. Si funciona, ¡accederás al dashboard! 🎉

**Ejecuta el SQL y luego intenta iniciar sesión de nuevo.** 🚀
