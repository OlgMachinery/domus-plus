# 🔐 Solución: Error de Login

## ⚠️ Error Actual
"Email o contraseña incorrectos"

## 🔍 Posibles Causas

### 1. Contraseña Incorrecta
La contraseña que estás usando no coincide con la que usaste al registrarte.

### 2. Usuario No Confirmado
Supabase puede requerir confirmación de email antes de permitir login.

### 3. Usuario No Creado Correctamente
El registro puede no haberse completado correctamente.

## ✅ Soluciones

### Opción 1: Verificar en Supabase

Ejecuta este SQL en Supabase para verificar:

```sql
-- Verificar usuario en auth.users
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = 'gonzalomail@me.com';

-- Verificar usuario en tabla users
SELECT id, email, name, phone, is_active
FROM public.users
WHERE email = 'gonzalomail@me.com';
```

### Opción 2: Resetear Contraseña

1. Ve a Supabase: **Authentication** → **Users**
2. Busca: `gonzalomail@me.com`
3. Clic en el usuario
4. Puedes resetear la contraseña desde ahí

### Opción 3: Registrar de Nuevo

Si el usuario no existe o hay problemas:

1. **Eliminar usuario existente** (si existe):
   - En Supabase: **Authentication** → **Users**
   - Busca y elimina el usuario `gonzalomail@me.com`
   - También elimina de la tabla `users` si existe

2. **Registrarse de nuevo:**
   - Ve a: http://localhost:3000/register
   - Completa el formulario
   - **Usa una contraseña que recuerdes**
   - Registrarse

3. **Iniciar sesión:**
   - Ve a: http://localhost:3000/login
   - Usa el email y la contraseña que acabas de crear

### Opción 4: Deshabilitar Confirmación de Email (Desarrollo)

Si estás en desarrollo y quieres evitar confirmación de email:

1. En Supabase: **Authentication** → **Settings** → **Email Auth**
2. Desactiva "Confirm email" temporalmente
3. O verifica el email si recibiste un correo de confirmación

## 🧪 Prueba Rápida

1. **Intenta registrarte de nuevo** con un email diferente:
   - Email: `test@example.com`
   - Contraseña: `test123456`
   - Registrarse

2. **Luego inicia sesión** con esas credenciales

3. Si funciona, el problema es con el usuario específico

## 💡 Consejos

- **Anota la contraseña** que usas al registrarte
- **Verifica el email** si Supabase envió un correo de confirmación
- **Usa contraseñas simples** para desarrollo (ej: `test123456`)

## ✅ Después de Resolver

Una vez que puedas iniciar sesión:
- ✅ Verás el dashboard de DOMUS+
- ✅ Podrás empezar a usar la aplicación
- ✅ Podrás crear presupuestos y transacciones

**¿Quieres que te ayude a verificar el usuario en Supabase o prefieres intentar registrarte de nuevo?**
