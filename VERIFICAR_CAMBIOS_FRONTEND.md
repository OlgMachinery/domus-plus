# 🔍 Verificar Cambios en el Frontend

## ⚠️ Problema: No se ven cambios en el navegador

Si no ves cambios en el navegador después de la migración, sigue estos pasos:

## 1. Verificar que el Servidor de Next.js esté Corriendo

```bash
cd frontend
npm run dev
```

El servidor debe estar corriendo en `http://localhost:3000`

## 2. Verificar que las Rutas API estén Funcionando

Abre la consola del navegador (F12) y verifica:

1. **No debe haber errores de conexión a `localhost:8000`**
   - Si ves errores como "Failed to fetch" o "Connection refused" a `localhost:8000`, significa que el frontend todavía está intentando conectarse al backend antiguo.

2. **Las llamadas deben ir a `/api/*`**
   - Abre la pestaña "Network" en las herramientas de desarrollador
   - Las peticiones deben ir a rutas como `/api/transactions`, `/api/budgets`, etc.
   - NO deben ir a `http://localhost:8000/api/*`

## 3. Cambios Realizados

### ✅ Archivos Actualizados:

1. **`frontend/lib/api.ts`**
   - ✅ Cambiado de `http://localhost:8000` a rutas relativas (`/api/*`)
   - ✅ Actualizado para usar tokens de Supabase en lugar de localStorage

2. **`frontend/app/budgets/page.tsx`**
   - ✅ `loadGlobalSummary()` ahora usa `/api/budgets/global-summary`
   - ✅ `loadAnnualMatrix()` ahora usa `/api/budgets/annual-matrix`

3. **`frontend/app/personal-budget/page.tsx`**
   - ✅ `loadCategories()` ahora usa `/api/personal-budgets/categories`
   - ✅ `loadBudgets()` ahora usa `/api/personal-budgets`
   - ✅ `handleCreateBudget()` ahora usa `/api/personal-budgets` (POST)
   - ✅ `handleDeleteBudget()` ahora usa `/api/personal-budgets/[id]` (DELETE)

4. **`frontend/app/users/page.tsx`**
   - ✅ `handleCreateUser()` ahora usa `/api/users/create`

5. **`frontend/components/AIAssistant.tsx`**
   - ✅ Ya estaba usando `/api/ai-assistant/chat` (correcto)

6. **`frontend/app/transactions/page.tsx`**
   - ✅ Ya estaba usando `/api/receipts/process` (correcto)

## 4. Verificar que las Páginas Carguen Datos

### Página de Presupuestos (`/budgets`):
- Debe cargar presupuestos desde Supabase directamente (esto está bien)
- Al hacer clic en "Matriz Anual" debe usar `/api/budgets/annual-matrix`
- Al hacer clic en "Resumen Global" debe usar `/api/budgets/global-summary`

### Página de Presupuestos Personales (`/personal-budget`):
- Debe cargar categorías desde `/api/personal-budgets/categories`
- Debe cargar presupuestos desde `/api/personal-budgets`
- Al crear un presupuesto debe usar `/api/personal-budgets` (POST)
- Al eliminar un presupuesto debe usar `/api/personal-budgets/[id]` (DELETE)

### Página de Transacciones (`/transactions`):
- Carga transacciones desde Supabase directamente (esto está bien)
- Al subir recibos usa `/api/receipts/process` (correcto)

## 5. Solución de Problemas

### Si ves errores 404 en `/api/*`:

1. **Verifica que el servidor de Next.js esté corriendo:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Verifica que los archivos de rutas API existan:**
   ```bash
   ls -la frontend/app/api/
   ```
   Debe mostrar todas las carpetas de rutas API.

3. **Reinicia el servidor de Next.js:**
   ```bash
   # Detener el servidor (Ctrl+C)
   # Luego reiniciar
   npm run dev
   ```

### Si ves errores de autenticación:

1. **Limpia las cookies y el localStorage:**
   - Abre las herramientas de desarrollador (F12)
   - Ve a "Application" > "Storage"
   - Limpia "Cookies" y "Local Storage"
   - Recarga la página

2. **Inicia sesión de nuevo:**
   - Ve a `/login`
   - Inicia sesión con tus credenciales

### Si no se cargan los datos:

1. **Verifica la consola del navegador:**
   - Abre las herramientas de desarrollador (F12)
   - Ve a la pestaña "Console"
   - Busca errores en rojo

2. **Verifica la pestaña Network:**
   - Abre las herramientas de desarrollador (F12)
   - Ve a la pestaña "Network"
   - Recarga la página
   - Verifica qué peticiones se están haciendo
   - Si ves peticiones a `localhost:8000`, hay un problema

## 6. Verificar que Todo Funcione

### Prueba estas acciones:

1. **Crear un presupuesto:**
   - Ve a `/budgets`
   - Haz clic en "Nuevo Presupuesto"
   - Completa el formulario
   - Verifica que se cree correctamente

2. **Ver matriz anual:**
   - Ve a `/budgets`
   - Haz clic en "Matriz Anual"
   - Debe cargar los datos desde `/api/budgets/annual-matrix`

3. **Crear presupuesto personal:**
   - Ve a `/personal-budget`
   - Haz clic en "Nuevo Presupuesto"
   - Completa el formulario
   - Verifica que se cree correctamente

4. **Subir un recibo:**
   - Ve a `/transactions`
   - Haz clic en "Subir Recibo"
   - Selecciona una imagen
   - Verifica que se procese correctamente

## 7. Si Aún No Funciona

1. **Verifica que el servidor de Next.js esté corriendo:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Verifica que no haya errores de compilación:**
   - El servidor debe mostrar "Ready" sin errores
   - Si hay errores, corrígelos primero

3. **Limpia el caché del navegador:**
   - Presiona `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac)
   - O limpia el caché manualmente

4. **Verifica las variables de entorno:**
   - Asegúrate de que `.env.local` tenga las variables correctas:
     ```
     NEXT_PUBLIC_SUPABASE_URL=tu_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
     ```

## 8. Diferencias Clave

### Antes (Backend FastAPI):
- Las peticiones iban a `http://localhost:8000/api/*`
- Requería que el backend de Python estuviera corriendo

### Ahora (Next.js API Routes):
- Las peticiones van a `/api/*` (rutas relativas)
- Todo corre en el mismo servidor de Next.js
- No necesitas el backend de Python corriendo

## ✅ Checklist

- [ ] Servidor de Next.js corriendo (`npm run dev`)
- [ ] No hay errores en la consola del navegador
- [ ] Las peticiones van a `/api/*` (no a `localhost:8000`)
- [ ] Puedes crear presupuestos
- [ ] Puedes ver la matriz anual
- [ ] Puedes crear presupuestos personales
- [ ] Puedes subir recibos
