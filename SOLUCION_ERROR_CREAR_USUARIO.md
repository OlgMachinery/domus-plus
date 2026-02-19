# 🔧 Solución: Error "Database error saving new user"

## ⚠️ Error
```
Error al crear usuario: Database error saving new user
```

## 🔍 Causas Posibles

1. **Políticas RLS bloqueando la inserción**
2. **Usuario ya existe en Supabase**
3. **Formato incorrecto del UUID**
4. **Problema con las políticas de INSERT en users**

## ✅ Soluciones

### Solución 1: Verificar y Ejecutar Políticas RLS

Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Verificar políticas existentes
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users' AND cmd = 'INSERT';

-- Si no existe la política para admins, crearla
DROP POLICY IF EXISTS "Admins can insert users" ON users;

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT 
    WITH CHECK (
        family_id IN (
            SELECT family_id 
            FROM users 
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );
```

**Archivo completo:** `supabase/rls-admin-crear-usuarios.sql`

### Solución 2: Verificar Variables de Entorno

Asegúrate de que `backend/.env` tenga:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

**Verificar:**
1. Ve a Supabase Dashboard
2. Settings → API
3. Copia la **service_role key** (NO la anon key)

### Solución 3: Verificar que el Usuario no Exista

Antes de crear, verifica en Supabase:

```sql
-- Verificar si el email existe
SELECT id, email, name 
FROM users 
WHERE email = 'email@ejemplo.com';

-- Verificar si el teléfono existe
SELECT id, email, phone 
FROM users 
WHERE phone = '+1234567890';
```

### Solución 4: Verificar Logs del Backend

Revisa los logs del backend para ver el error exacto:

```bash
cd backend
uvicorn app.main:app --reload
```

Busca mensajes que empiecen con:
- `❌ Error al crear usuario`
- `🔧 Intentando insertar usuario`
- `⚠️`

## 🔍 Diagnóstico

### Paso 1: Verificar Políticas RLS

Ejecuta en Supabase SQL Editor:

```sql
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY cmd, policyname;
```

**Deberías ver:**
- Una política con `cmd = 'INSERT'` y `policyname` como "Admins can insert users"

### Paso 2: Verificar que Seas Administrador

Ejecuta en Supabase SQL Editor:

```sql
SELECT id, email, name, is_family_admin, family_id
FROM users
WHERE id = auth.uid();
```

**Verifica:**
- `is_family_admin` debe ser `true`
- `family_id` no debe ser `NULL`

### Paso 3: Probar Inserción Manual

Ejecuta en Supabase SQL Editor (reemplaza los valores):

```sql
-- Obtener tu family_id
SELECT family_id FROM users WHERE id = auth.uid() AND is_family_admin = true;

-- Intentar insertar manualmente (reemplaza los valores)
INSERT INTO users (id, email, phone, name, is_active, is_family_admin, family_id)
VALUES (
    gen_random_uuid(),
    'test@example.com',
    '+1234567890',
    'Test User',
    true,
    false,
    (SELECT family_id FROM users WHERE id = auth.uid() AND is_family_admin = true LIMIT 1)
);
```

**Si esto falla:**
- Las políticas RLS están bloqueando
- Ejecuta `supabase/rls-admin-crear-usuarios.sql`

**Si esto funciona:**
- El problema está en el código del backend
- Verifica los logs del backend

## ✅ Cambios Realizados en el Código

1. **Mejor manejo de errores:**
   - Mensajes más descriptivos
   - Detección de errores de RLS
   - Limpieza automática si falla

2. **Verificación mejorada:**
   - Verifica en Supabase antes de crear
   - Mejor formato de UUID

3. **Logs mejorados:**
   - Más información de depuración
   - Mensajes claros de éxito/error

## 🧪 Probar Después de Corregir

1. **Ejecuta el SQL de políticas RLS** (Solución 1)
2. **Verifica variables de entorno** (Solución 2)
3. **Reinicia el backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```
4. **Intenta crear un usuario desde `/users`**

## 📝 Notas

- El error "Database error saving new user" viene de Supabase
- Generalmente es un problema de políticas RLS
- El código ahora tiene mejor manejo de errores y logs

**¡Ejecuta el SQL de políticas RLS y prueba de nuevo!** 🚀
