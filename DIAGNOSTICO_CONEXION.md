# 🔍 Diagnóstico de Conexión Frontend-Backend

## Verificar que Todo Está Corriendo

### 1. Verificar Backend

Abre en tu navegador:
- http://localhost:8000/health
- **Debería mostrar**: `{"status":"ok"}`

Si no funciona:
```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### 2. Verificar Frontend

Abre en tu navegador:
- http://localhost:3000
- **Debería mostrar**: La página de inicio de DOMUS+

Si no funciona:
```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev
```

### 3. Verificar Endpoint de Registro

Abre en tu navegador:
- http://localhost:8000/api/users/register
- **Debería mostrar**: Un error de método (eso es normal, significa que el endpoint existe)

### 4. Verificar en la Consola del Navegador

1. Abre la página de registro: http://localhost:3000/register
2. Presiona `F12` o `Cmd+Option+I` (Mac) para abrir las herramientas de desarrollador
3. Ve a la pestaña **Console**
4. Intenta registrarte
5. Revisa los errores que aparezcan

**Errores comunes:**
- `Network Error` o `Failed to fetch`: El backend no está corriendo o hay un problema de CORS
- `404 Not Found`: El endpoint no existe o la URL está mal
- `500 Internal Server Error`: Error en el backend

### 5. Verificar CORS

En la consola del navegador, busca errores como:
```
Access to XMLHttpRequest at 'http://localhost:8000/api/users/register' from origin 'http://localhost:3000' has been blocked by CORS policy
```

Si ves esto, el problema es de CORS. El backend ya está configurado para permitir `http://localhost:3000`, así que esto no debería pasar.

## Soluciones Rápidas

### Solución 1: Hard Refresh
En el navegador, presiona:
- **Mac**: `Cmd + Shift + R`
- **Windows/Linux**: `Ctrl + Shift + R`

### Solución 2: Reiniciar Ambos Servidores

**Terminal 1 (Backend):**
```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 (Frontend):**
```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev
```

### Solución 3: Verificar que el Backend Está Escuchando en el Puerto Correcto

En la terminal del backend, deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Si ves un error o el puerto es diferente, hay un problema.

## Prueba de Conexión Directa

Abre en tu navegador:
```
http://localhost:8000/api/users/register
```

Deberías ver un error JSON como:
```json
{"detail":"Method Not Allowed"}
```

Esto significa que el endpoint existe y está funcionando (solo que necesita POST, no GET).

## Si Nada Funciona

1. **Cierra todas las terminales**
2. **Cierra el navegador completamente**
3. **Abre todo de nuevo:**
   - Terminal 1: Backend (`uvicorn app.main:app --reload`)
   - Terminal 2: Frontend (`npm run dev`)
   - Navegador: http://localhost:3000/register

