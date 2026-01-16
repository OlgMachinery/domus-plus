# 🔄 Instrucciones para Reiniciar el Backend

## Problema
El backend está corriendo pero no responde a las peticiones (timeout).

## Solución: Reiniciar el Backend Manualmente

### Paso 1: Detener el Backend Actual

1. **Abre una terminal**
2. **Encuentra el proceso que está usando el puerto 8000:**
   ```bash
   lsof -ti:8000
   ```
   
3. **Detén el proceso:**
   ```bash
   lsof -ti:8000 | xargs kill -9
   ```

   O si prefieres ver qué proceso es:
   ```bash
   lsof -i:8000
   ```
   Luego usa el PID que aparezca:
   ```bash
   kill -9 [PID]
   ```

### Paso 2: Iniciar el Backend de Nuevo

1. **Ve al directorio del backend:**
   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/backend
   ```

2. **Activa el entorno virtual:**
   ```bash
   source venv/bin/activate
   ```

3. **Configura la base de datos:**
   ```bash
   export DATABASE_URL="sqlite:///./domus_plus.db"
   ```

4. **Inicia el servidor:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Paso 3: Verificar que Funciona

Deberías ver en la terminal:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

Luego abre en tu navegador:
- http://localhost:8000/health
- Debería mostrar: `{"status":"ok"}`

### Paso 4: Probar el Login

1. Vuelve a la página de login: http://localhost:3000/login
2. Intenta iniciar sesión de nuevo
3. Debería funcionar correctamente

## Alternativa: Usar el Script de Inicio

También puedes usar el script que ya existe:

```bash
cd /Users/gonzalomontanofimbres/domus-plus
./iniciar-backend.sh
```

## Si Sigue Sin Funcionar

1. **Verifica que no haya otro proceso usando el puerto:**
   ```bash
   lsof -i:8000
   ```

2. **Verifica los logs del backend** (si los guardaste):
   ```bash
   tail -f /tmp/backend.log
   ```

3. **Revisa que el entorno virtual esté activado:**
   ```bash
   which python
   # Debería mostrar: /Users/gonzalomontanofimbres/domus-plus/backend/venv/bin/python
   ```

4. **Verifica que las dependencias estén instaladas:**
   ```bash
   pip list | grep fastapi
   ```
