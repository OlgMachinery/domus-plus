# 🔍 Verificar Cambios en Supabase

## 📋 Script de Verificación

He creado un script completo para verificar el estado actual de Supabase después de los cambios.

### Paso 1: Ejecutar Script de Verificación

1. **Abre Supabase SQL Editor**
2. **Ejecuta:** `supabase/verificar-estado-completo.sql`
3. **Revisa los resultados** de cada sección

El script verifica:
- ✅ Funciones SQL creadas
- ✅ Políticas RLS en `users`
- ✅ Políticas RLS en `family_budgets`
- ✅ Políticas RLS en `user_budgets`
- ✅ RLS habilitado en las tablas
- ✅ Estructura de las tablas
- ✅ Permisos de las funciones

## 🔍 Qué Buscar en los Resultados

### 1. Funciones SQL (Deben existir 6)
- `create_family`
- `assign_family_admin`
- `add_family_member`
- `create_family_for_user`
- `get_user_family_id`
- `is_family_admin`

**Si faltan:** Ejecuta `supabase/flujo-crear-familia-completo.sql`

### 2. Políticas RLS en Users (Deben existir al menos 2-3)
- `Users can view own data` (SELECT)
- `Users can view family members` (SELECT) - **IMPORTANTE para ver integrantes**
- `Admins can view family users` (SELECT) - Opcional pero recomendado

**Si faltan:** Ejecuta `supabase/fix-rls-ver-miembros-familia.sql`

### 3. Políticas RLS en Family Budgets (Deben existir 4)
- `Users can view family budgets` (SELECT)
- `Family admins can insert budgets` (INSERT) - **IMPORTANTE para crear presupuestos**
- `Family admins can update budgets` (UPDATE)
- `Family admins can delete budgets` (DELETE)

**Si faltan:** Ejecuta `supabase/fix-rls-presupuestos-completo.sql`

### 4. Políticas RLS en User Budgets (Deben existir al menos 2)
- `Users can view own user budgets` (SELECT)
- `Family admins can insert user budgets` (INSERT)

**Si faltan:** Ejecuta `supabase/fix-rls-presupuestos-completo.sql`

### 5. RLS Habilitado
Todas las tablas deben tener `rls_habilitado = true`

## 🚨 Problemas Comunes y Soluciones

### Problema: "No se encontraron funciones"
**Solución:** Ejecuta `supabase/flujo-crear-familia-completo.sql`

### Problema: "No se pueden ver miembros de la familia"
**Solución:** Ejecuta `supabase/fix-rls-ver-miembros-familia.sql`

### Problema: "No se pueden crear presupuestos"
**Solución:** Ejecuta `supabase/fix-rls-presupuestos-completo.sql`

### Problema: "RLS no está habilitado"
**Solución:** Ejecuta:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;
```

## 📝 Scripts a Ejecutar (en orden)

Si algo falta, ejecuta estos scripts en este orden:

1. **`supabase/flujo-crear-familia-completo.sql`**
   - Crea funciones para crear familia y asignar usuarios

2. **`supabase/fix-rls-ver-miembros-familia.sql`**
   - Permite ver miembros de la familia

3. **`supabase/fix-rls-presupuestos-completo.sql`**
   - Permite crear presupuestos

## ✅ Verificación Rápida

Ejecuta esta consulta para verificar rápidamente:

```sql
-- Verificar funciones
SELECT proname FROM pg_proc 
WHERE proname IN ('create_family', 'assign_family_admin', 'add_family_member', 'create_family_for_user', 'get_user_family_id', 'is_family_admin')
ORDER BY proname;

-- Verificar políticas RLS críticas
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('users', 'family_budgets', 'user_budgets')
AND cmd IN ('SELECT', 'INSERT')
ORDER BY tablename, cmd;
```

## 🆘 Si Algo No Funciona

Comparte:
1. Los resultados del script de verificación
2. El error específico que estás viendo
3. Qué funcionalidad no está trabajando (ver integrantes, crear presupuestos, etc.)
