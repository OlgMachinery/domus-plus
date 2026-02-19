# 📋 Instrucciones: Ejecutar Función para Crear Familia

## ⚠️ Importante

**NO ejecutes la línea de prueba sola.** Primero debes ejecutar todo el script para crear la función.

## ✅ Paso 1: Ejecutar el Script Completo

1. **En Supabase SQL Editor**, asegúrate de tener seleccionado TODO el contenido del archivo `supabase/funcion-crear-familia-auto.sql`

2. **Elimina cualquier línea de prueba** como:
   ```sql
   SELECT * FROM create_family_for_user('tu-user-id-aqui'::UUID, 'Mi Familia');
   ```

3. **Ejecuta solo el script de creación de la función** (desde `CREATE OR REPLACE FUNCTION` hasta el final, pero sin las líneas de prueba)

4. **Haz clic en "Run"** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)

5. **Deberías ver:**
   - Mensajes de éxito al crear la función
   - Una tabla al final mostrando que la función fue creada

## ✅ Paso 2: Probar desde la Aplicación (Recomendado)

**No necesitas probar la función manualmente.** Simplemente:

1. **Recarga la página de la aplicación:**
   - Ve a `http://localhost:3000`
   - Ve a "Importar Excel"
   - Recarga la página con `Ctrl+Shift+R` (o `Cmd+Shift+R` en Mac)

2. **Intenta importar:**
   - Haz clic en "Importar Presupuestos" o "Setup Completo desde Excel"
   - El sistema automáticamente:
     - Detectará que no tienes familia
     - Llamará a la función `create_family_for_user`
     - Creará la familia automáticamente
     - Continuará con la importación

## 🔍 Si Quieres Probar la Función Manualmente

Si realmente quieres probar la función manualmente, primero necesitas obtener tu `user_id` real:

### Opción 1: Obtener user_id desde la aplicación

1. Abre la consola del navegador (F12)
2. En la pestaña "Console", ejecuta:
   ```javascript
   // Esto mostrará tu user_id
   (async () => {
     const { createClient } = await import('/lib/supabase/client');
     const supabase = createClient();
     const { data: { user } } = await supabase.auth.getUser();
     console.log('Tu user_id es:', user?.id);
   })();
   ```

3. Copia el UUID que aparece

4. En Supabase SQL Editor, ejecuta:
   ```sql
   SELECT * FROM create_family_for_user('TU-UUID-AQUI'::UUID, 'Mi Familia');
   ```
   (Reemplaza `TU-UUID-AQUI` con el UUID que copiaste)

### Opción 2: Obtener user_id desde Supabase

1. En Supabase SQL Editor, ejecuta:
   ```sql
   SELECT id, email, name, family_id 
   FROM users 
   WHERE email = 'gonzalomail@me.com';
   ```

2. Copia el `id` (UUID) que aparece

3. Ejecuta la función con ese UUID:
   ```sql
   SELECT * FROM create_family_for_user('TU-UUID-AQUI'::UUID, 'Mi Familia');
   ```

## ✅ Paso 3: Verificar que Funcionó

Después de ejecutar el script completo, verifica:

```sql
-- Verificar que la función existe
SELECT proname, prokind
FROM pg_proc
WHERE proname = 'create_family_for_user';
```

Deberías ver una fila con `proname = 'create_family_for_user'`.

## 🚨 Errores Comunes

### Error: "function create_family_for_user does not exist"
**Solución:** Ejecuta el script completo de creación de la función primero.

### Error: "invalid input syntax for type uuid"
**Solución:** Estás usando un UUID de ejemplo. Obtén tu UUID real usando una de las opciones arriba.

### Error: "permission denied"
**Solución:** Asegúrate de estar ejecutando el script como usuario con permisos (generalmente `postgres` o `authenticated`).

## 💡 Recomendación

**La forma más fácil es simplemente ejecutar el script completo y luego probar desde la aplicación.** La función se llamará automáticamente cuando intentes importar presupuestos.
