# 🔒 Solución: Error de Row Level Security (RLS)

## ⚠️ Error Actual
"new row violates row-level security policy for table 'users'"

## 🔍 ¿Qué significa?

Las políticas de Row Level Security (RLS) en Supabase están bloqueando la creación de nuevos usuarios. Esto es porque las políticas actuales solo permiten SELECT y UPDATE, pero no INSERT.

## ✅ Solución: Agregar Política de INSERT

Necesitas ejecutar un SQL adicional en Supabase para permitir que los usuarios se registren.

### Pasos:

1. **Ve a Supabase SQL Editor:**
   - https://supabase.com/dashboard/project/lpmslitbvlihzucorenj
   - Clic en **SQL Editor** en el menú lateral
   - Clic en **New Query**

2. **Copia y pega este SQL:**

```sql
-- Política: Permitir INSERT en users durante el registro
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

## 📋 SQL Completo para Copiar

El archivo `supabase/fix-rls-policies.sql` contiene el SQL necesario.

## 🔍 Verificar Políticas

Después de ejecutar el SQL, puedes verificar las políticas:

1. En Supabase: **Table Editor** → **users**
2. Clic en el icono de candado (🔒) para ver las políticas RLS
3. Deberías ver la nueva política "Users can insert own data"

## ✅ Después de Agregar la Política

Una vez que agregues la política:
- ✅ Podrás registrarte sin problemas
- ✅ El usuario se creará en `auth.users` (automático)
- ✅ El usuario se creará en la tabla `users` (nuestra tabla)
- ✅ Podrás iniciar sesión normalmente

## 🎯 Estado

- ✅ Esquema SQL ejecutado
- ✅ Tablas creadas
- ⏳ Falta: Política RLS para INSERT (ejecutar el SQL de arriba)

**Ejecuta el SQL y vuelve a intentar registrarte. ¡Debería funcionar!** 🚀
