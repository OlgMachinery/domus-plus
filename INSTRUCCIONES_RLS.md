# 🔒 Solución Rápida: Error de RLS

## ⚠️ Error
"new row violates row-level security policy for table 'users'"

## ✅ Solución (2 minutos)

### Paso 1: Abre SQL Editor en Supabase
1. Ve a: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj
2. Clic en **SQL Editor** (menú lateral)
3. Clic en **New Query**

### Paso 2: Copia y Pega este SQL

```sql
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);
```

### Paso 3: Ejecuta
- Clic en **Run** (botón verde) o **Cmd+Enter**
- Deberías ver: "Success. No rows returned"

### Paso 4: Vuelve a Registrarte
- Regresa a: http://localhost:3000/register
- Completa el formulario
- Clic en "Registrarse"
- **¡Debería funcionar ahora!** ✅

## 📋 Archivo Listo

El SQL también está en: `EJECUTAR_ESTE_SQL.sql`

## 🎯 ¿Por qué?

Las políticas RLS actuales solo permiten SELECT y UPDATE, pero no INSERT. Necesitamos agregar una política que permita a los usuarios insertar su propio registro durante el registro.

## ✅ Después de Ejecutar

Una vez que ejecutes el SQL:
- ✅ Podrás registrarte sin problemas
- ✅ El usuario se creará correctamente
- ✅ Podrás iniciar sesión

**¡Ejecuta el SQL y vuelve a intentar!** 🚀
