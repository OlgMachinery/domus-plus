# 🔐 Implementar Sistema de Roles: Administrador y Usuario

## 🎯 Objetivos

1. **Administradores** pueden:
   - Crear usuarios sin validar correo
   - Crear cualquier tipo de presupuesto (compartido o individual)

2. **Usuarios** pueden:
   - Crear solo presupuestos individuales para ellos mismos

## ✅ Pasos de Implementación

### Paso 1: Ejecutar Políticas RLS para Presupuestos

1. **Ve a Supabase SQL Editor:**
   - Abre tu proyecto en https://supabase.com/dashboard
   - Clic en **SQL Editor** → **New Query**

2. **Copia y pega el contenido de:** `supabase/rls-roles-presupuestos.sql`

3. **Ejecuta el SQL** (Run o Cmd+Enter)

Esto crea políticas que:
- ✅ Permiten a administradores crear cualquier presupuesto
- ✅ Permiten a usuarios crear solo presupuestos individuales para ellos mismos

### Paso 2: Ejecutar Políticas RLS para Crear Usuarios

1. **En el mismo SQL Editor, crea una nueva query**

2. **Copia y pega el contenido de:** `supabase/rls-admin-crear-usuarios.sql`

3. **Ejecuta el SQL**

Esto permite que:
- ✅ Administradores puedan crear usuarios en su familia
- ✅ Administradores puedan ver y actualizar usuarios de su familia

### Paso 3: Crear Función para Crear Usuarios (Opcional)

**Nota:** La función SQL `create_user_by_admin` crea el usuario en `public.users` pero NO en `auth.users`. Para crear también en `auth.users`, necesitas usar el backend con service_role key.

1. **En SQL Editor, crea una nueva query**

2. **Copia y pega el contenido de:** `supabase/funcion-crear-usuario-admin.sql`

3. **Ejecuta el SQL**

**Alternativa:** Usar el backend para crear usuarios en `auth.users` también. El endpoint `/api/users/create` intenta usar esta función, pero si no existe, puedes crear un endpoint en el backend que use `service_role` key.

## 📋 Verificar Políticas

Ejecuta este SQL para verificar las políticas:

```sql
-- Verificar políticas de presupuestos
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;

-- Verificar políticas de usuarios
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;
```

## 🎨 Funcionalidades Implementadas

### 1. Página de Gestión de Usuarios

- **Ruta:** `/users`
- **Acceso:** Solo administradores
- **Funcionalidad:**
  - Ver lista de usuarios de la familia
  - Crear nuevos usuarios sin validar correo
  - Ver roles y estados de usuarios

### 2. Restricciones en Presupuestos

- **Usuarios normales:**
  - Solo pueden crear presupuestos individuales
  - El presupuesto se asigna automáticamente a ellos mismos
  - No pueden crear presupuestos compartidos

- **Administradores:**
  - Pueden crear cualquier tipo de presupuesto
  - Pueden crear presupuestos compartidos
  - Pueden crear presupuestos individuales para cualquier usuario

### 3. API para Crear Usuarios

- **Ruta:** `/api/users/create`
- **Método:** POST
- **Autenticación:** Requiere ser administrador
- **Campos:**
  - `name`: Nombre del usuario
  - `email`: Email (no se valida)
  - `phone`: Teléfono
  - `password`: Contraseña (mínimo 6 caracteres)

## ⚠️ Nota Importante sobre Creación de Usuarios

La función SQL `create_user_by_admin` crea el usuario en `public.users` pero **NO** en `auth.users` de Supabase. Esto significa:

1. El usuario aparecerá en la lista de usuarios
2. El usuario **NO** podrá iniciar sesión hasta que se cree en `auth.users`

**Opciones para crear en `auth.users`:**

1. **Usar el backend con service_role key:**
   - Crear un endpoint en el backend que use `supabase.auth.admin.createUser()`
   - Requiere la `SUPABASE_SERVICE_ROLE_KEY` (nunca exponerla en el frontend)

2. **Usar webhook de Supabase:**
   - Configurar un webhook que cree en `auth.users` cuando se inserta en `public.users`

3. **Crear manualmente:**
   - El administrador puede crear el usuario manualmente desde Supabase Dashboard

## 🔍 Verificar que Funciona

### Para Administradores:

1. **Crear Usuario:**
   - Ve a `/users`
   - Clic en "Crear Usuario"
   - Completa el formulario
   - El usuario se crea sin validar correo

2. **Crear Presupuesto Compartido:**
   - Ve a `/budgets`
   - Clic en "Crear Presupuesto"
   - Puedes crear presupuestos compartidos o individuales

### Para Usuarios Normales:

1. **Crear Presupuesto Individual:**
   - Ve a `/budgets`
   - Clic en "Crear Presupuesto"
   - Solo puedes crear presupuestos individuales
   - El sistema te asigna automáticamente el presupuesto

2. **Intentar Crear Presupuesto Compartido:**
   - Si intentas crear un presupuesto compartido, verás un mensaje de error
   - Solo los administradores pueden crear presupuestos compartidos

## ✅ Estado

- ✅ Políticas RLS creadas para roles
- ✅ Página de gestión de usuarios creada
- ✅ Restricciones en creación de presupuestos implementadas
- ✅ API para crear usuarios implementada
- ⚠️ Nota: Crear usuario en `auth.users` requiere backend o webhook

**¡El sistema de roles está implementado!** 🚀
