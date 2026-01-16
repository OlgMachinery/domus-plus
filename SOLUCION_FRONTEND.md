# 🔧 Solución: Frontend No Conecta con Backend

## Problema
El backend está funcionando (`{"status":"ok"}`), pero el frontend muestra error de conexión.

## Solución: Recargar el Frontend

### Opción 1: Hard Refresh en el Navegador

1. **En el navegador**, presiona:
   - **Mac**: `Cmd + Shift + R` o `Cmd + Option + R`
   - **Windows/Linux**: `Ctrl + Shift + R` o `Ctrl + F5`

2. Esto fuerza al navegador a recargar completamente la página sin usar caché.

### Opción 2: Reiniciar el Frontend

1. **En la terminal del frontend**, presiona `Ctrl+C` para detenerlo
2. **Luego ejecuta de nuevo:**
   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/frontend
   npm run dev
   ```

### Opción 3: Verificar que Ambos Estén Corriendo

**Terminal 1 (Frontend):**
```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev
```
Deberías ver: `- Local: http://localhost:3000`

**Terminal 2 (Backend):**
```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
uvicorn app.main:app --reload
```
Deberías ver: `INFO: Uvicorn running on http://127.0.0.1:8000`

## Verificar Conexión

1. Abre en el navegador: http://localhost:8000/health
   - Debería mostrar: `{"status":"ok"}`

2. Abre en el navegador: http://localhost:8000/api/users/register
   - Debería mostrar un error de método (eso es normal, significa que el endpoint existe)

3. Intenta registrarte de nuevo en: http://localhost:3000/register

## Si Aún No Funciona

Abre la **Consola del Navegador** (F12 o Cmd+Option+I) y revisa si hay errores de CORS o conexión.

