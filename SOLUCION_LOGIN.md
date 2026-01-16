# 🔐 Solución: Error de Login

## ⚠️ Error Actual
"Email o contraseña incorrectos"

## 🔍 Posibles Causas

### 1. Usuario No Registrado
Si es la primera vez que usas la aplicación, **debes registrarte primero**.

### 2. Credenciales Incorrectas
El email o contraseña no coinciden con los registrados.

## ✅ Solución

### Opción 1: Registrarse Primero (Recomendado)

1. **Ve a la página de registro:**
   - Clic en "Regístrate" en la página de login
   - O ve directamente a: http://localhost:3000/register

2. **Completa el formulario:**
   - Nombre completo
   - Email: `gonzalomail@me.com` (o el que prefieras)
   - Teléfono: Tu número de WhatsApp (ej: +521234567890)
   - Contraseña: La que quieras usar
   - Confirmar contraseña: La misma

3. **Registrarse:**
   - Clic en "Registrarse"
   - Deberías ser redirigido al login

4. **Iniciar sesión:**
   - Usa el email y contraseña que acabas de crear

### Opción 2: Verificar Usuario Existente

Si ya te registraste antes:

1. **Verifica en Supabase:**
   - Ve a: https://supabase.com/dashboard/project/lpmslitbvlihzucorenj
   - Clic en **Authentication** → **Users**
   - Verifica que tu usuario exista

2. **Si el usuario existe pero no puedes iniciar sesión:**
   - Puede ser que la contraseña sea diferente
   - O que el usuario no esté en la tabla `users`

### Opción 3: Resetear Contraseña

Si olvidaste la contraseña:

1. En Supabase: **Authentication** → **Users**
2. Encuentra tu usuario
3. Puedes resetear la contraseña desde ahí

## 🧪 Probar Registro

1. Ve a: http://localhost:3000/register
2. Completa el formulario
3. Registra tu cuenta
4. Luego inicia sesión

## 📝 Nota Importante

Con Supabase, el registro crea automáticamente:
- Un usuario en `auth.users` (manejado por Supabase)
- Un registro en la tabla `users` (nuestra tabla personalizada)

Si el registro falla, puede ser porque:
- El email ya existe
- Hay un error en la creación del registro en la tabla `users`

## 🔍 Verificar en Supabase

Después de registrarte, verifica:

1. **Authentication → Users**: Deberías ver tu usuario
2. **Table Editor → users**: Deberías ver tu registro con email, nombre, etc.

## 💡 Si el Registro Falla

Si ves un error al registrarte, puede ser porque:
- El email ya está registrado
- Hay un problema con la creación del registro en la tabla `users`

En ese caso, puedes:
1. Usar un email diferente
2. O eliminar el usuario existente en Supabase y volver a registrarte
