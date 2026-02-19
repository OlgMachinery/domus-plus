# Solución: Los datos del Excel no se cargan al presupuesto

## Problema
Al hacer clic en "Importar Presupuestos" o "Setup Completo desde Excel", los datos no se están importando correctamente a la base de datos.

## Posibles Causas

### 1. Políticas RLS (Row Level Security)
Las políticas RLS pueden estar bloqueando la inserción de presupuestos. Verifica que tengas las políticas correctas ejecutadas en Supabase.

**Solución:**
Ejecuta este SQL en Supabase SQL Editor:

```sql
-- Verificar políticas existentes
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'family_budgets'
ORDER BY cmd, policyname;
```

Si no ves políticas para `INSERT`, ejecuta:

```sql
-- Política: Los administradores de familia pueden INSERTAR presupuestos
CREATE POLICY "Family admins can insert budgets" ON family_budgets
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

### 2. Categorías/Subcategorías no válidas
El sistema mapea las categorías del Excel a mayúsculas con guiones bajos. Si las categorías en el Excel no coinciden con el formato esperado, puede haber errores.

**Solución:**
- Revisa la consola del navegador (F12) para ver los errores específicos
- Revisa los logs del servidor de Next.js para ver qué categorías están causando problemas
- Asegúrate de que el Excel tenga la hoja "Input Categories Budget" con la estructura correcta

### 3. Usuario no es administrador
Solo los administradores de familia pueden importar presupuestos.

**Solución:**
Verifica que tu usuario tenga `is_family_admin = true`:

```sql
SELECT id, email, is_family_admin, family_id
FROM users
WHERE id = auth.uid();
```

### 4. Formato del archivo Excel
El archivo Excel debe tener:
- Hoja llamada "Input Categories Budget"
- Columnas: Type, Category, Subcategory
- Filas con los meses (JANUARY, FEBRUARY, etc.) en el header
- Datos en la sección EXPENSES

## Cómo Diagnosticar

### Paso 1: Revisar la consola del navegador
1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña "Console"
3. Intenta importar nuevamente
4. Busca mensajes de error en rojo

### Paso 2: Revisar los logs del servidor
1. Ve a la terminal donde corre `npm run dev`
2. Busca mensajes que empiecen con "Error" o "Procesando presupuesto"
3. Los logs ahora muestran:
   - Cuántos presupuestos se están procesando
   - Qué categorías/subcategorías se están procesando
   - Errores específicos de inserción

### Paso 3: Verificar el resultado de la importación
Después de hacer clic en "Importar Presupuestos", deberías ver:
- Un mensaje de éxito con el número de presupuestos importados
- Si hay errores, se mostrarán en una lista detallada
- Los errores ahora se muestran en la interfaz con más detalle

## Mejoras Implementadas

1. **Logging mejorado**: Ahora se registran más detalles sobre cada presupuesto que se intenta importar
2. **Manejo de errores mejorado**: Los errores se muestran con más detalle en la interfaz
3. **Validación de categorías**: Se limpian caracteres especiales de las categorías antes de insertar
4. **Mensajes más claros**: Los mensajes de error ahora son más descriptivos

## Próximos Pasos

1. **Intenta importar nuevamente** y revisa:
   - La consola del navegador (F12)
   - Los logs del servidor
   - El mensaje de resultado en la página

2. **Si ves errores específicos**, compártelos para poder diagnosticar mejor

3. **Verifica las políticas RLS** ejecutando el SQL de verificación arriba

4. **Si el problema persiste**, revisa:
   - Que el archivo Excel tenga la estructura correcta
   - Que tu usuario sea administrador de familia
   - Que tengas una familia asignada (`family_id` no es NULL)
