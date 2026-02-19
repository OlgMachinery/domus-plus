# 🔍 Verificar Permisos para Crear Presupuestos

## ⚠️ Problema

El sistema no permite crear presupuestos desde Excel. Esto puede deberse a:
1. Políticas RLS (Row Level Security) mal configuradas
2. El usuario no tiene `is_family_admin = true`
3. El usuario no tiene `family_id` asignado
4. Recursión infinita en las políticas RLS

## ✅ Solución Paso a Paso

### Paso 1: Ejecutar Script SQL Completo

1. **Abre Supabase SQL Editor**
2. **Ejecuta el script completo:** `supabase/fix-rls-presupuestos-completo.sql`
3. **Verifica que no haya errores**

Este script:
- ✅ Crea funciones helper para evitar recursión RLS
- ✅ Configura políticas RLS correctas para `family_budgets`
- ✅ Configura políticas RLS correctas para `user_budgets`
- ✅ Verifica que todo esté correcto

### Paso 2: Verificar Permisos del Usuario

Ejecuta en Supabase SQL Editor:

```sql
-- Reemplaza 'TU-EMAIL-AQUI' con tu email
SELECT 
    id,
    email,
    name,
    family_id,
    is_family_admin,
    is_active,
    CASE 
        WHEN family_id IS NULL THEN '❌ No tiene familia asignada'
        WHEN is_family_admin = false THEN '❌ No es administrador de familia'
        WHEN is_family_admin = true THEN '✅ Puede crear presupuestos'
        ELSE '⚠️ Estado desconocido'
    END as estado_permisos
FROM users
WHERE email = 'TU-EMAIL-AQUI';
```

**Si el usuario no tiene familia o no es admin:**
- Si no tiene familia: Ejecuta `supabase/funcion-crear-familia-auto.sql` o usa la función `create_family_for_user`
- Si no es admin: Ejecuta:

```sql
-- Reemplaza 'TU-USER-ID' con tu user_id
UPDATE users
SET is_family_admin = true
WHERE id = 'TU-USER-ID'::UUID;
```

### Paso 3: Verificar Políticas RLS

Ejecuta en Supabase SQL Editor:

```sql
-- Verificar políticas de family_budgets
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual::text, 1, 150)
        ELSE 'Sin USING'
    END as using_clause
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;
```

**Debes ver:**
- ✅ "Users can view family budgets" (SELECT)
- ✅ "Family admins can insert budgets" (INSERT)
- ✅ "Family admins can update budgets" (UPDATE)
- ✅ "Family admins can delete budgets" (DELETE)

### Paso 4: Probar la Importación

1. **Recarga la página** de importar Excel
2. **Selecciona los presupuestos** que quieres importar
3. **Haz clic en "Importar X Presupuesto(s)"**
4. **Revisa la consola del navegador** (F12) para ver errores detallados

## 🔍 Diagnóstico de Errores Comunes

### Error: "new row violates row-level security policy"

**Causa:** Las políticas RLS están bloqueando la inserción.

**Solución:**
1. Verifica que ejecutaste `fix-rls-presupuestos-completo.sql`
2. Verifica que el usuario tiene `is_family_admin = true`
3. Verifica que el usuario tiene `family_id` asignado

### Error: "infinite recursion detected in policy"

**Causa:** Las políticas RLS están consultando la tabla `users` directamente, causando recursión.

**Solución:**
1. Ejecuta `fix-rls-presupuestos-completo.sql` que usa funciones `SECURITY DEFINER`
2. Estas funciones evitan la recursión

### Error: "permission denied for table family_budgets"

**Causa:** El usuario no tiene permisos o las políticas RLS están mal configuradas.

**Solución:**
1. Verifica que RLS esté habilitado: `ALTER TABLE family_budgets ENABLE ROW LEVEL SECURITY;`
2. Verifica que las políticas existan (ver Paso 3)
3. Verifica que el usuario sea admin (ver Paso 2)

## 📋 Checklist Final

Antes de intentar importar, verifica:

- [ ] Script `fix-rls-presupuestos-completo.sql` ejecutado sin errores
- [ ] Usuario tiene `family_id` asignado
- [ ] Usuario tiene `is_family_admin = true`
- [ ] Políticas RLS existen y están correctas
- [ ] Funciones helper (`is_family_admin`, `get_user_family_id`) existen
- [ ] No hay errores en la consola del navegador

## 🆘 Si Nada Funciona

Comparte:
1. El error exacto de la consola del navegador (F12)
2. El resultado de la consulta del Paso 2 (sin mostrar el user_id completo)
3. El resultado de la consulta del Paso 3
