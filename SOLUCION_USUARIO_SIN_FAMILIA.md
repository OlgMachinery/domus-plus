# 🔧 Solución: Usuario Sin Familia Asignada

## 🔍 Problema

Estás viendo este error:
```
El usuario actual no tiene una familia asignada
```

**Causa:** Tu usuario en la base de datos no tiene un `family_id` asignado, que es necesario para importar presupuestos.

## ✅ Solución Rápida

### Opción 1: Crear Familia Automáticamente (Recomendado)

Ejecuta esta parte del script SQL en Supabase SQL Editor:

```sql
-- Crear familia para tu usuario específico
DO $$
DECLARE
    v_user_id UUID;
    v_family_id INTEGER;
BEGIN
    -- Obtener tu ID de usuario por email
    SELECT id INTO v_user_id
    FROM users
    WHERE email = 'gonzalomail@me.com';  -- Tu email
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado';
    END IF;
    
    -- Crear una nueva familia
    INSERT INTO families (name, admin_id, created_at, updated_at)
    VALUES (
        'Mi Familia',
        v_user_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_family_id;
    
    -- Asignar la familia al usuario y hacerlo admin
    UPDATE users
    SET 
        family_id = v_family_id,
        is_family_admin = true,
        updated_at = NOW()
    WHERE id = v_user_id;
    
    RAISE NOTICE 'Familia creada con ID: %', v_family_id;
END $$;
```

### Opción 2: Asignar a Familia Existente

Si ya existe una familia y quieres asignarte a ella:

```sql
-- Reemplaza 1 con el ID de la familia existente
UPDATE users
SET family_id = 1
WHERE email = 'gonzalomail@me.com';
```

### Opción 3: Script Completo (Todos los Usuarios Sin Familia)

Si hay múltiples usuarios sin familia, ejecuta esta parte del script:

```sql
-- Crear familia para todos los usuarios sin familia
DO $$
DECLARE
    v_user_id UUID;
    v_family_id INTEGER;
    v_user_name TEXT;
    v_user_email TEXT;
BEGIN
    FOR v_user_id, v_user_name, v_user_email IN 
        SELECT id, name, email
        FROM users
        WHERE family_id IS NULL
    LOOP
        INSERT INTO families (name, admin_id, created_at, updated_at)
        VALUES (
            COALESCE(v_user_name, 'Familia de ' || SPLIT_PART(v_user_email, '@', 1)),
            v_user_id,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_family_id;
        
        UPDATE users
        SET 
            family_id = v_family_id,
            is_family_admin = true,
            updated_at = NOW()
        WHERE id = v_user_id;
        
        RAISE NOTICE 'Familia % creada para usuario %', v_family_id, v_user_email;
    END LOOP;
END $$;
```

## 📋 Pasos Detallados

### Paso 1: Abrir Supabase SQL Editor

1. Ve a https://supabase.com
2. Abre tu proyecto
3. Haz clic en "SQL Editor" en el menú lateral

### Paso 2: Ejecutar el Script

1. Abre el archivo `supabase/asignar-familia-usuario.sql`
2. Copia la sección que necesites (Opción 1, 2 o 3)
3. **IMPORTANTE:** Reemplaza `'gonzalomail@me.com'` con tu email real
4. Pégalo en el SQL Editor
5. Haz clic en "Run" o presiona `Ctrl+Enter`

### Paso 3: Verificar

Ejecuta esta consulta para verificar:

```sql
SELECT 
    u.email,
    u.name,
    u.family_id,
    u.is_family_admin,
    f.name as family_name
FROM users u
LEFT JOIN families f ON u.family_id = f.id
WHERE u.email = 'gonzalomail@me.com';
```

Deberías ver:
- `family_id` no es NULL
- `is_family_admin` es `true`
- `family_name` tiene un nombre

### Paso 4: Recargar la Aplicación

1. **Recarga la página completamente:**
   - `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac)

2. **Verifica:**
   - El error "El usuario actual no tiene una familia asignada" debería desaparecer
   - Los botones de importación deberían funcionar
   - Deberías poder importar presupuestos

## 🔍 Verificación Adicional

Si quieres ver todos los usuarios y sus familias:

```sql
SELECT 
    u.id,
    u.email,
    u.name,
    u.family_id,
    u.is_family_admin,
    f.name as family_name,
    f.admin_id as family_admin_id
FROM users u
LEFT JOIN families f ON u.family_id = f.id
ORDER BY u.email;
```

## 🚨 Si el Error Persiste

1. **Verifica que el UPDATE se ejecutó:**
   ```sql
   SELECT family_id, is_family_admin FROM users WHERE email = 'tu-email@ejemplo.com';
   ```

2. **Verifica que la familia existe:**
   ```sql
   SELECT * FROM families WHERE id = (SELECT family_id FROM users WHERE email = 'tu-email@ejemplo.com');
   ```

3. **Si `family_id` sigue siendo NULL:**
   - Verifica que no hay errores al ejecutar el script
   - Asegúrate de que el email es correcto
   - Revisa los logs de Supabase para errores

## 💡 Nota Importante

Después de asignar una familia:
- El usuario se convierte automáticamente en `is_family_admin = true`
- Esto le permite importar presupuestos
- Puede crear otros usuarios en su familia
- Puede gestionar todos los presupuestos de la familia
