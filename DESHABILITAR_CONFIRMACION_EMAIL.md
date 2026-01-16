# 📧 Deshabilitar Confirmación de Email (Desarrollo)

## 🔍 Problema Identificado

El usuario existe pero `email_confirmed_at` es `NULL`, lo que significa que el email no está confirmado. Esto puede impedir el login.

## ✅ Solución 1: Confirmar Email Manualmente

Ejecuta este SQL en Supabase:

```sql
-- Confirmar email del usuario
UPDATE auth.users
SET 
    email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email = 'gonzalomail@me.com';
```

Luego intenta iniciar sesión de nuevo.

## ✅ Solución 2: Deshabilitar Confirmación de Email (Recomendado para Desarrollo)

1. **Ve a Supabase:**
   - https://supabase.com/dashboard/project/lpmslitbvlihzucorenj
   - **Authentication** → **Settings** → **Email Auth**

2. **Desactiva la confirmación:**
   - Busca la opción **"Confirm email"** o **"Enable email confirmations"**
   - **Desactívala** (toggle off)
   - **Guarda los cambios**

3. **Ahora los nuevos usuarios no necesitarán confirmar email**

## ✅ Solución 3: Verificar Usuario en Tabla users

Ejecuta este SQL para verificar que el usuario también existe en la tabla `users`:

```sql
SELECT id, email, name, phone, is_active
FROM public.users
WHERE email = 'gonzalomail@me.com';
```

Si no existe, el trigger puede no haberse ejecutado. En ese caso:

```sql
-- Crear manualmente el registro en users
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'name', 'Usuario'),
    COALESCE(raw_user_meta_data->>'phone', ''),
    true,
    false
FROM auth.users
WHERE email = 'gonzalomail@me.com'
ON CONFLICT (id) DO NOTHING;
```

## 🎯 Pasos Recomendados

1. **Confirmar el email** (Solución 1) - Ejecuta el SQL
2. **Deshabilitar confirmación** (Solución 2) - Para futuros usuarios
3. **Verificar tabla users** (Solución 3) - Asegurar que existe
4. **Intentar login de nuevo**

## ✅ Después de Confirmar

Una vez que confirmes el email:
- ✅ Podrás iniciar sesión sin problemas
- ✅ Accederás al dashboard
- ✅ Podrás usar la aplicación

**Ejecuta el SQL de confirmación y luego intenta iniciar sesión de nuevo.** 🚀
