# ✅ Prueba el Registro Ahora

## 🎯 Estado Actual

Has ejecutado el SQL que incluye la política de INSERT. Ahora deberías poder registrarte.

## 🧪 Prueba el Registro

1. **Ve a la página de registro:**
   - http://localhost:3000/register
   - O clic en "Regístrate" desde el login

2. **Completa el formulario:**
   - Nombre: Gonzalo Montaño (o el que prefieras)
   - Email: gonzalomail@me.com (o el que prefieras)
   - Teléfono: +526865690472 (o el tuyo)
   - Contraseña: La que quieras usar
   - Confirmar Contraseña: La misma

3. **Clic en "Registrarse"**

4. **Resultado esperado:**
   - ✅ Deberías ser redirigido al login
   - ✅ Deberías ver un mensaje de éxito (si está configurado)
   - ✅ NO deberías ver el error de RLS

## 🔍 Si Aún Hay Error

### Verificar la Política

Ejecuta este SQL en Supabase para verificar:

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'users';
```

Deberías ver 3 políticas, incluyendo una con `cmd = 'INSERT'`.

### Si la Política No Existe

Si no ves la política de INSERT, ejecuta solo esto:

```sql
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT 
    WITH CHECK (auth.uid() = id);
```

## ✅ Después del Registro Exitoso

1. **Inicia sesión:**
   - Ve a: http://localhost:3000/login
   - Usa el email y contraseña que acabas de crear
   - Clic en "Iniciar Sesión"

2. **Deberías acceder al dashboard:**
   - Verás el dashboard de DOMUS+
   - Podrás empezar a usar la aplicación

## 🎉 ¡Prueba Ahora!

Ve a http://localhost:3000/register y completa el registro. ¡Debería funcionar! 🚀
