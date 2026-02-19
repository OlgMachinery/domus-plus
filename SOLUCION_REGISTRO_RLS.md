# 🔧 Solución: Error de RLS en Registro de Usuarios

## ⚠️ Error Actual
"new row violates row-level security policy for table 'users'"

## 🔍 ¿Qué está pasando?

El usuario se crea correctamente en Supabase Auth, pero cuando intenta insertar el registro en la tabla `users`, la política RLS (Row Level Security) lo está bloqueando.

## ✅ Solución Rápida: Ejecutar SQL en Supabase

### Opción 1: Política RLS Simple (Recomendada)

1. **Ve a Supabase SQL Editor:**
   - Abre tu proyecto en https://supabase.com/dashboard
   - Clic en **SQL Editor** en el menú lateral
   - Clic en **New Query**

2. **Copia y pega este SQL:**

```sql
-- Eliminar política existente si hay conflictos
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Crear política que permita INSERT durante el registro
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);
```

3. **Ejecuta el SQL:**
   - Clic en **Run** (botón verde) o presiona **Cmd+Enter**
   - Deberías ver: "Success. No rows returned"

4. **Vuelve a intentar registrarte:**
   - Regresa a: http://localhost:3000/register
   - Completa el formulario
   - Clic en "Registrarse"
   - ¡Debería funcionar ahora!

### Opción 2: Setup Completo (Si la Opción 1 no funciona)

Si la opción 1 no funciona, ejecuta el setup completo que incluye una función con permisos elevados:

1. **Abre el archivo:** `supabase/setup-completo-usuarios.sql`
2. **Copia todo el contenido**
3. **Pégalo en Supabase SQL Editor**
4. **Ejecuta el SQL**

Este setup crea:
- ✅ Función `ensure_user_exists` con permisos de administrador
- ✅ Políticas RLS para SELECT, INSERT y UPDATE
- ✅ Sincronización de usuarios existentes

## 🔍 Verificar que Funcionó

Ejecuta este SQL para verificar las políticas:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
```

Deberías ver al menos una política con `cmd = 'INSERT'`.

## 📝 Nota Técnica

La ruta de API `/api/auth/register` ahora intenta usar la función `ensure_user_exists` primero (que tiene permisos de administrador), y si no existe, hace un INSERT directo. Si el INSERT directo falla, es porque falta la política RLS.

## ✅ Después de Ejecutar el SQL

1. **Intenta registrarte de nuevo:**
   - Ve a: http://localhost:3000/register
   - Completa el formulario
   - Clic en "Registrarse"

2. **Deberías ver:**
   - ✅ Redirección a la página de login
   - ✅ Mensaje de éxito (si está configurado)
   - ✅ NO deberías ver el error de RLS

3. **Inicia sesión:**
   - Ve a: http://localhost:3000/login
   - Usa el email y contraseña que acabas de crear
   - Deberías acceder al dashboard

## 🎯 Estado

- ✅ Formulario de registro creado
- ✅ Ruta de API configurada
- ⏳ Falta: Política RLS de INSERT (ejecutar el SQL de arriba)

**Ejecuta el SQL y vuelve a intentar registrarte. ¡Debería funcionar!** 🚀
