# 🔧 Solución: Error de CORS

## Problema
El error en la consola muestra:
```
Access to XMLHttpRequest at 'http://localhost:8000/api/users/login' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solución

### 1. Reiniciar el Backend

**IMPORTANTE**: Después de cambiar la configuración de CORS, **debes reiniciar el servidor backend**.

1. En la terminal del backend, presiona `Ctrl+C` para detenerlo
2. Ejecuta de nuevo:
   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/backend
   source venv/bin/activate
   uvicorn app.main:app --reload
   ```

3. Deberías ver:
   ```
   INFO:     Uvicorn running on http://127.0.0.1:8000
   INFO:     Application startup complete.
   ```

### 2. Verificar que CORS Funciona

1. Abre en tu navegador: http://localhost:8000/health
   - Debería mostrar: `{"status":"ok"}`

2. Abre las herramientas de desarrollador (F12)
3. Ve a la pestaña **Network** (Red)
4. Intenta hacer login de nuevo
5. Busca la petición a `/api/users/login`
6. En los **Headers** de la respuesta, deberías ver:
   ```
   Access-Control-Allow-Origin: http://localhost:3000
   ```

### 3. Si Aún No Funciona

**Verifica que el backend esté realmente corriendo:**

Abre en tu navegador:
- http://localhost:8000/docs
- Deberías ver la documentación interactiva de FastAPI

Si no funciona, el backend no está corriendo correctamente.

### 4. Limpiar Caché del Navegador

1. En el navegador, presiona `Cmd + Shift + Delete` (Mac) o `Ctrl + Shift + Delete` (Windows)
2. Selecciona "Caché" o "Cached images and files"
3. Haz clic en "Limpiar datos"
4. Recarga la página

## Verificación Final

Después de reiniciar el backend:

1. **Abre la consola del navegador** (F12)
2. **Intenta hacer login de nuevo**
3. **El error de CORS debería desaparecer**

Si el error persiste, comparte:
- El mensaje exacto del error en la consola
- Lo que muestra la terminal del backend

