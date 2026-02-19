# 🔧 Solución: Error al Crear Presupuestos (RLS)

## ⚠️ Problema
No se puede crear presupuestos - el sistema no guarda los presupuestos.

## 🔍 Causa
Faltan las políticas RLS (Row Level Security) para INSERT y UPDATE en las tablas `family_budgets` y `user_budgets`. El esquema actual solo tiene políticas para SELECT (ver), pero no para crear o modificar.

## ✅ Solución: Ejecutar SQL en Supabase

### Paso 1: Políticas para family_budgets

1. **Ve a Supabase SQL Editor:**
   - Abre tu proyecto en https://supabase.com/dashboard
   - Clic en **SQL Editor** en el menú lateral
   - Clic en **New Query**

2. **Copia y pega este SQL:**

```sql
-- Eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Users can insert family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Users can update family budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can insert budgets" ON family_budgets;
DROP POLICY IF EXISTS "Family admins can update budgets" ON family_budgets;

-- Política: Los administradores de familia pueden INSERTAR presupuestos
CREATE POLICY "Family admins can insert budgets" ON family_budgets
    FOR INSERT 
    WITH CHECK (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden ACTUALIZAR presupuestos
CREATE POLICY "Family admins can update budgets" ON family_budgets
    FOR UPDATE 
    USING (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    )
    WITH CHECK (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );

-- Política: Los administradores de familia pueden ELIMINAR presupuestos
CREATE POLICY "Family admins can delete budgets" ON family_budgets
    FOR DELETE 
    USING (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );
```

3. **Ejecuta el SQL** (Run o Cmd+Enter)

### Paso 2: Políticas para user_budgets

1. **En el mismo SQL Editor, crea una nueva query**

2. **Copia y pega este SQL:**

```sql
-- Eliminar políticas existentes si hay conflictos
DROP POLICY IF EXISTS "Users can insert own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Users can update own user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Family admins can insert user budgets" ON user_budgets;
DROP POLICY IF EXISTS "Family admins can update user budgets" ON user_budgets;

-- Política: Los administradores de familia pueden INSERTAR presupuestos de usuario
CREATE POLICY "Family admins can insert user budgets" ON user_budgets
    FOR INSERT 
    WITH CHECK (
        user_id IN (
            SELECT id 
            FROM users 
            WHERE family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    );

-- Política: Los administradores de familia pueden ACTUALIZAR presupuestos de usuario
CREATE POLICY "Family admins can update user budgets" ON user_budgets
    FOR UPDATE 
    USING (
        user_id IN (
            SELECT id 
            FROM users 
            WHERE family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT id 
            FROM users 
            WHERE family_id IN (
                SELECT family_id 
                FROM users 
                WHERE id = auth.uid() 
                AND is_family_admin = true
            )
        )
    );
```

3. **Ejecuta el SQL**

## 🔍 Verificar que Funcionó

Ejecuta este SQL para verificar las políticas:

```sql
-- Verificar políticas en family_budgets
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;

-- Verificar políticas en user_budgets
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'user_budgets'
ORDER BY cmd, policyname;
```

Deberías ver políticas con `cmd = 'INSERT'` y `cmd = 'UPDATE'` en ambas tablas.

## ⚠️ Importante: Verificar que eres Administrador

Las políticas solo permiten crear presupuestos si eres administrador de familia (`is_family_admin = true`).

Para verificar tu estado:

```sql
SELECT id, email, name, is_family_admin, family_id
FROM users
WHERE id = auth.uid();
```

Si `is_family_admin` es `false`, necesitas actualizarlo:

```sql
UPDATE users
SET is_family_admin = true
WHERE id = auth.uid();
```

## ✅ Después de Ejecutar el SQL

1. **Intenta crear un presupuesto:**
   - Ve a la página de presupuestos
   - Completa el formulario
   - Clic en "Guardar" o "Crear"

2. **Deberías ver:**
   - ✅ El presupuesto se crea correctamente
   - ✅ Aparece en la lista de presupuestos
   - ✅ NO deberías ver errores de RLS

## 📝 Nota Técnica

Las políticas RLS están configuradas para que solo los administradores de familia (`is_family_admin = true`) puedan crear y modificar presupuestos. Esto es por seguridad y control.

## 🎯 Estado

- ✅ Formulario de presupuestos funcional
- ✅ Código de creación correcto
- ⏳ Falta: Políticas RLS de INSERT/UPDATE (ejecutar el SQL de arriba)

**Ejecuta el SQL y vuelve a intentar crear un presupuesto. ¡Debería funcionar!** 🚀
