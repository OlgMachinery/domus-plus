# 🔧 Solución: Usuarios Faltantes en Tabla users

## ⚠️ Problema Identificado

El mensaje "Usuario creado, pero hubo un problema al crear el perfil" indica que:
- ✅ El usuario se creó en `auth.users` (Supabase Auth)
- ❌ El usuario NO se creó en la tabla `users` (nuestra tabla)

Esto puede pasar si:
- El trigger no se ejecutó
- Hubo un error de RLS al insertar
- El código de registro falló silenciosamente

## ✅ Solución 1: Crear Usuarios Faltantes (SQL)

Ejecuta este SQL en Supabase para crear todos los usuarios faltantes:

```sql
-- Crear usuarios que existen en auth.users pero no en users
INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', 'Usuario'),
    COALESCE(au.raw_user_meta_data->>'phone', ''),
    true,
    false
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

Este SQL:
- ✅ Encuentra usuarios en `auth.users` que no están en `users`
- ✅ Los crea automáticamente
- ✅ Usa metadata si está disponible
- ✅ No duplica si ya existen

## ✅ Solución 2: Código Actualizado

He actualizado el código de login para que:
- ✅ Si el usuario no existe en `users`, lo crea automáticamente
- ✅ Esto funciona como fallback si el trigger falla
- ✅ El usuario puede iniciar sesión incluso si el registro falló parcialmente

## 🧪 Después de Ejecutar el SQL

1. **Ejecuta el SQL** en Supabase (arriba)
2. **Intenta iniciar sesión** de nuevo:
   - Email: `gonzalomail@me.com` o `procentros@gmail.com`
   - Contraseña: La que usaste al registrarte
3. **Debería funcionar ahora** ✅

## 🔍 Verificar Usuarios

Ejecuta este SQL para ver todos los usuarios:

```sql
-- Ver usuarios en auth.users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC;

-- Ver usuarios en tabla users
SELECT id, email, name, phone, is_active, created_at
FROM public.users
ORDER BY created_at DESC;

-- Ver usuarios que faltan
SELECT 
    au.id,
    au.email,
    '❌ Falta en tabla users' as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;
```

## ✅ Estado

- ✅ Código de login actualizado (crea usuario automáticamente si falta)
- ✅ SQL para crear usuarios faltantes creado
- ⏳ Falta: Ejecutar el SQL en Supabase

**Ejecuta el SQL y luego intenta iniciar sesión. El código también creará el usuario automáticamente si falta.** 🚀
