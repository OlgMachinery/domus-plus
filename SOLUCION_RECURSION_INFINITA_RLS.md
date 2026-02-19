# 🔧 Solución: Recursión Infinita en Políticas RLS

## 🔍 Problema

Estás viendo este error en la consola:
```
Error cargando datos del usuario: {
  code: '42P17',
  message: 'infinite recursion detected in policy for relation "users"'
}
```

**Causa:** Las políticas RLS en la tabla `users` están consultando la misma tabla `users`, creando un bucle infinito.

Por ejemplo, si una política dice:
```sql
"Puedes ver usuarios si eres admin de la familia"
```

Y para verificar eso consulta:
```sql
SELECT is_family_admin FROM users WHERE id = auth.uid()
```

Esto crea una recursión porque:
1. La política intenta verificar si puedes ver `users`
2. Para eso consulta `users`
3. Pero consultar `users` requiere verificar la política
4. Y así infinitamente...

## ✅ Solución

### Paso 1: Ejecutar el Script SQL

1. **Abre Supabase Dashboard:**
   - Ve a tu proyecto en https://supabase.com
   - Haz clic en "SQL Editor" en el menú lateral

2. **Ejecuta el script:**
   - Abre el archivo `supabase/fix-rls-infinite-recursion.sql`
   - Copia todo el contenido
   - Pégalo en el SQL Editor de Supabase
   - Haz clic en "Run" o presiona `Ctrl+Enter`

3. **Verifica que se ejecutó correctamente:**
   - Deberías ver un mensaje de éxito
   - La última consulta mostrará las políticas creadas

### Paso 2: Recargar la Aplicación

1. **Recarga la página del navegador:**
   - Presiona `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac)
   - O cierra y vuelve a abrir la pestaña

2. **Verifica la consola:**
   - Abre las herramientas de desarrollador (F12)
   - Ve a la pestaña "Console"
   - Los errores de recursión infinita deberían desaparecer

3. **Verifica que los botones funcionan:**
   - Los botones "Importar Presupuestos" deberían estar activos
   - Deberías poder cargar el usuario sin errores

## 🔍 Cómo Funciona la Solución

### Antes (Con Recursión):
```sql
-- ❌ MALO: Consulta la tabla users dentro de la política
CREATE POLICY "Admins can view family users" ON users
    FOR SELECT 
    USING (
        family_id IN (
            SELECT family_id 
            FROM users  -- ← Esto causa recursión
            WHERE id = auth.uid() 
            AND is_family_admin = true
        )
    );
```

### Después (Sin Recursión):
```sql
-- ✅ BUENO: Usa funciones SECURITY DEFINER
CREATE POLICY "Admins can view family users" ON users
    FOR SELECT 
    USING (
        id = auth.uid()  -- ← Sin recursión
        OR
        (
            public.is_family_admin(auth.uid()) = true  -- ← Función, no consulta directa
            AND family_id = public.get_user_family_id(auth.uid())
        )
    );
```

Las funciones `SECURITY DEFINER` se ejecutan con privilegios elevados y pueden consultar la tabla sin pasar por RLS, evitando la recursión.

## 📋 Verificación

Después de ejecutar el script, verifica:

1. **En Supabase SQL Editor, ejecuta:**
   ```sql
   SELECT policyname, cmd
   FROM pg_policies 
   WHERE tablename = 'users'
   ORDER BY cmd, policyname;
   ```

   Deberías ver:
   - `Users can view own data` (SELECT)
   - `Admins can view family users` (SELECT)
   - `Users can insert own data` (INSERT)
   - `Admins can insert users` (INSERT)
   - `Users can update own data` (UPDATE)
   - `Admins can update family users` (UPDATE)

2. **En el navegador:**
   - Abre la consola (F12)
   - No deberías ver errores de recursión infinita
   - Los datos del usuario deberían cargarse correctamente

## 🚨 Si el Error Persiste

1. **Verifica que las funciones se crearon:**
   ```sql
   SELECT proname, prokind
   FROM pg_proc
   WHERE proname IN ('get_user_family_id', 'is_family_admin');
   ```

2. **Verifica permisos de las funciones:**
   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_name IN ('get_user_family_id', 'is_family_admin');
   ```

3. **Si hay errores al ejecutar el script:**
   - Revisa los mensajes de error en Supabase
   - Asegúrate de tener permisos de administrador en Supabase
   - Intenta ejecutar el script por partes (cada sección separadamente)

## 💡 Prevención

Para evitar este problema en el futuro:
- **Nunca consultes la misma tabla dentro de su política RLS**
- **Usa funciones `SECURITY DEFINER` cuando necesites consultar la tabla protegida**
- **Usa `auth.uid()` directamente cuando sea posible** (no requiere consulta)

## 📝 Notas Técnicas

- Las funciones `SECURITY DEFINER` se ejecutan con los privilegios del usuario que las creó (generalmente el superusuario)
- Esto permite que consulten tablas sin pasar por RLS
- Es seguro porque las funciones solo devuelven datos específicos, no exponen toda la tabla
