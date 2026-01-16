# 🔧 Implementar Trigger Automático - Solución Definitiva

## 🎯 Solución

En lugar de depender de políticas RLS complejas, usaremos un **trigger automático** que crea el registro en `users` cuando se crea en `auth.users`.

## ✅ Pasos

### 1. Ejecutar SQL del Trigger

1. Ve a Supabase SQL Editor:
   - https://supabase.com/dashboard/project/lpmslitbvlihzucorenj
   - SQL Editor → New Query

2. Copia y pega este SQL:

```sql
-- Función que se ejecuta cuando se crea un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    name, 
    phone, 
    is_active, 
    is_family_admin
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    true,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que se ejecuta después de crear usuario en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

3. Ejecuta (Run o Cmd+Enter)
4. Deberías ver: "Success. No rows returned"

### 2. Código Actualizado

He actualizado el código de registro para:
- ✅ Enviar metadata (name, phone) en signUp
- ✅ El trigger crea automáticamente el registro en `users`
- ✅ Verificar que se creó correctamente
- ✅ Fallback si el trigger no funciona

### 3. Probar el Registro

1. Ve a: http://localhost:3000/register
2. Completa el formulario
3. Clic en "Registrarse"
4. **¡Debería funcionar ahora!** ✅

## 🔍 Ventajas de esta Solución

- ✅ **Automático**: No depende de políticas RLS complejas
- ✅ **Seguro**: El trigger usa SECURITY DEFINER
- ✅ **Confiable**: Se ejecuta siempre que se crea un usuario
- ✅ **Sin errores RLS**: El trigger tiene permisos especiales

## 📋 Verificar

Después de ejecutar el trigger, puedes verificar:

```sql
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Deberías ver el trigger listado.

## 🎉 ¡Listo!

Ejecuta el SQL del trigger y prueba el registro. ¡Debería funcionar perfectamente! 🚀
