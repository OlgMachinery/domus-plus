# 🔒 Solución Definitiva: Error RLS en Registro

## ⚠️ Problema

El error "new row violates row-level security policy" persiste incluso después de crear la política.

## 🔍 Causa Posible

Durante el `signUp` de Supabase, puede haber un momento donde `auth.uid()` no está completamente disponible cuando se intenta insertar en la tabla `users`.

## ✅ Solución 1: Verificar y Recrear la Política

Ejecuta este SQL en Supabase:

```sql
-- Eliminar política existente
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- Crear política nueva
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);
```

## ✅ Solución 2: Usar Trigger Automático (Recomendado)

Si la política sigue fallando, podemos usar un trigger que cree automáticamente el registro en `users` cuando se crea en `auth.users`:

```sql
-- Función para crear usuario automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, phone, is_active, is_family_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta cuando se crea un usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Con esta solución:**
- El registro en `users` se crea automáticamente
- No necesitas insertar manualmente desde el frontend
- La política RLS puede ser más restrictiva

## ✅ Solución 3: Modificar el Código de Registro

Si prefieres mantener el código actual, podemos modificar el registro para usar el service_role key temporalmente:

```typescript
// En app/register/page.tsx, después de signUp:
// Usar una API route del servidor que tenga service_role
```

## 🎯 Recomendación

**Usa la Solución 2 (Trigger)** porque:
- ✅ Más seguro
- ✅ Automático
- ✅ No depende de políticas RLS complejas
- ✅ Sincroniza automáticamente auth.users con users

## 📋 Pasos para Solución 2

1. Ejecuta el SQL del trigger en Supabase
2. Modifica el código de registro para NO insertar manualmente en `users`
3. El trigger lo hará automáticamente

¿Quieres que implemente la Solución 2 (Trigger automático)?
