# 🔍 Verificar Problema de Login

## ⚠️ Error Actual
"Email o contraseña incorrectos"

## 🔍 Posibles Causas

1. **Email no confirmado** - Ya ejecutaste el SQL para confirmar, pero verifica
2. **Contraseña incorrecta** - La contraseña que usas no coincide
3. **Usuario no existe en tabla users** - El trigger puede no haber funcionado
4. **Problema con el código de login** - Puede haber un error en la lógica

## ✅ Verificaciones en Supabase

### 1. Verificar que el email está confirmado:

```sql
SELECT 
    id,
    email,
    email_confirmed_at,
    CASE 
        WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmado'
        ELSE '❌ NO confirmado'
    END as status
FROM auth.users
WHERE email = 'gonzalomail@me.com';
```

Si `email_confirmed_at` es NULL, ejecuta:

```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'gonzalomail@me.com';
```

### 2. Verificar que el usuario existe en tabla users:

```sql
SELECT 
    id,
    email,
    name,
    phone,
    is_active,
    CASE 
        WHEN is_active THEN '✅ Activo'
        ELSE '❌ Inactivo'
    END as status
FROM public.users
WHERE email = 'gonzalomail@me.com';
```

Si NO existe, el trigger no funcionó. Crea manualmente:

```sql
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
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    phone = COALESCE(EXCLUDED.phone, users.phone);
```

### 3. Verificar que los IDs coinciden:

```sql
SELECT 
    au.id as auth_id,
    u.id as user_id,
    au.email,
    CASE 
        WHEN au.id = u.id THEN '✅ IDs coinciden'
        ELSE '❌ IDs NO coinciden'
    END as match_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email = 'gonzalomail@me.com';
```

## 🔧 Solución Rápida

Si el usuario no existe en la tabla `users`, ejecuta este SQL completo:

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
    name = COALESCE(EXCLUDED.name, users.name),
    phone = COALESCE(EXCLUDED.phone, users.phone),
    is_active = true;
```

## 🧪 Después de Ejecutar

1. **Ejecuta el SQL de arriba** en Supabase
2. **Intenta iniciar sesión de nuevo:**
   - Email: `gonzalomail@me.com`
   - Contraseña: La que usaste al registrarte
3. **Debería funcionar ahora** ✅

## 💡 Si Aún No Funciona

Si después de ejecutar el SQL sigue sin funcionar:

1. **Regístrate de nuevo** con un email diferente (ej: `test@example.com`)
2. **Usa una contraseña simple** que recuerdes (ej: `test123456`)
3. **Confirma el email** con el SQL
4. **Intenta iniciar sesión**

**Ejecuta el SQL de verificación y solución, luego intenta iniciar sesión de nuevo.** 🚀
