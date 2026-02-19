# 🔧 Solución: Error "Database error saving new user" en Registro

## ⚠️ Error
```
Error al crear usuario: Database error saving new user
```

Este error ocurre cuando un usuario intenta **registrarse** (no cuando un admin crea un usuario).

## 🔍 Causa

El error se debe a que **falta la política RLS de INSERT** que permite que los usuarios se registren. Cuando un usuario se registra:

1. ✅ Se crea en `auth.users` (Supabase Auth)
2. ❌ Falla al crear en `public.users` porque las políticas RLS lo bloquean

## ✅ Solución: Ejecutar SQL en Supabase

### Paso 1: Ejecutar Política RLS para Registro

1. **Ve a Supabase SQL Editor:**
   - Abre tu proyecto en https://supabase.com/dashboard
   - Clic en **SQL Editor** → **New Query**

2. **Copia y pega este SQL:**

```sql
-- Eliminar política existente si hay conflictos
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Política: Los usuarios pueden INSERTAR su propio registro durante el registro
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);
```

3. **Ejecuta el SQL** (Run o Cmd+Enter)

4. **Verifica que se creó:**

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
```

Deberías ver la política "Users can insert own data".

### Paso 2: Verificar Función ensure_user_exists (Opcional)

Si quieres usar la función `ensure_user_exists` en lugar del INSERT directo:

1. **Ejecuta el SQL de:** `supabase/setup-completo-usuarios.sql`
2. Esto crea la función con `SECURITY DEFINER` que puede hacer INSERT sin problemas de RLS

## 🧪 Probar el Registro

1. **Ve a:** http://localhost:3000/register
2. **Completa el formulario:**
   - Nombre
   - Email
   - Teléfono
   - Contraseña (mínimo 6 caracteres)
   - Confirmar Contraseña
3. **Clic en "Registrarse"**

**Resultado esperado:**
- ✅ Usuario creado en `auth.users`
- ✅ Usuario creado en `public.users`
- ✅ Redirección a la página de login
- ✅ NO deberías ver el error

## 🔍 Verificar en Supabase

1. **Ve a Supabase Dashboard**
2. **Authentication → Users**
3. **Deberías ver el nuevo usuario**
4. **Table Editor → users**
5. **Deberías ver el registro en `public.users`**

## 🐛 Si Aún Hay Error

### Verificar Políticas RLS

Ejecuta este SQL para ver todas las políticas:

```sql
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;
```

**Deberías ver:**
- Una política con `cmd = 'INSERT'` y `policyname = 'Users can insert own data'`

### Verificar que el Usuario se Creó en auth.users

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'tu-email@ejemplo.com';
```

Si el usuario existe en `auth.users` pero no en `public.users`, el problema es de RLS.

### Probar Inserción Manual

Ejecuta este SQL (reemplaza con el ID del usuario de auth.users):

```sql
-- Obtener el ID del usuario de auth.users
SELECT id, email FROM auth.users WHERE email = 'tu-email@ejemplo.com';

-- Intentar insertar manualmente (reemplaza el ID)
INSERT INTO users (id, email, phone, name, is_active, is_family_admin)
VALUES (
    'ID_DEL_USUARIO_DE_AUTH',
    'tu-email@ejemplo.com',
    '+1234567890',
    'Tu Nombre',
    true,
    false
);
```

**Si esto falla:**
- Las políticas RLS están bloqueando
- Ejecuta el SQL de arriba nuevamente

**Si esto funciona:**
- El problema está en el código del frontend
- Verifica los logs del navegador (F12 → Console)

## 📝 Notas

- La política permite que usuarios inserten su propio registro (`auth.uid() = id`)
- Durante `signUp`, `auth.uid()` está disponible
- El usuario no necesita `family_id` para registrarse (se puede asignar después)

## ✅ Archivos Relacionados

- `supabase/fix-rls-registro-usuarios.sql` - SQL para ejecutar
- `supabase/fix-rls-insert.sql` - Alternativa
- `supabase/setup-completo-usuarios.sql` - Setup completo con función

**¡Ejecuta el SQL y prueba el registro de nuevo!** 🚀
