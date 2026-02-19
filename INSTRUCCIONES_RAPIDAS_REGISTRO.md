# 🚀 Instrucciones Rápidas: Solucionar Error de Registro

## ⚠️ Error Actual
```
Error al crear usuario: Database error saving new user
```

## ✅ Solución Rápida (2 minutos)

### Paso 1: Abrir Supabase SQL Editor

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Clic en **SQL Editor** en el menú lateral izquierdo
4. Clic en **New Query** (botón verde)

### Paso 2: Copiar y Pegar SQL

Copia **TODO** el contenido del archivo:
**`supabase/verificar-y-fix-rls-registro.sql`**

Pégalo en el editor SQL.

### Paso 3: Ejecutar

1. Clic en **Run** (botón verde) o presiona **Cmd+Enter** (Mac) / **Ctrl+Enter** (Windows)
2. Deberías ver mensajes de éxito

### Paso 4: Verificar

En la misma query, deberías ver al final:
- Una tabla con las políticas creadas
- Confirmación de que RLS está habilitado

### Paso 5: Probar Registro

1. Ve a: http://localhost:3000/register
2. Completa el formulario
3. Clic en "Registrarse"
4. **¡Debería funcionar ahora!** ✅

## 🔍 Si Aún No Funciona

### Verificar en Supabase

Ejecuta este SQL para verificar:

```sql
-- Verificar políticas
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';
```

**Deberías ver:** "Users can insert own data"

### Verificar RLS

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```

**Deberías ver:** `rowsecurity = true`

### Si RLS está deshabilitado

Ejecuta:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

## 📝 Notas

- El SQL elimina políticas conflictivas antes de crear la correcta
- La política permite que usuarios inserten su propio registro (`auth.uid() = id`)
- Durante el registro, `auth.uid()` está disponible automáticamente

## ✅ Archivo a Ejecutar

**`supabase/verificar-y-fix-rls-registro.sql`**

Este archivo:
- ✅ Verifica políticas actuales
- ✅ Elimina políticas conflictivas
- ✅ Crea la política correcta
- ✅ Verifica que todo esté bien

**¡Ejecuta el SQL y prueba el registro!** 🚀
