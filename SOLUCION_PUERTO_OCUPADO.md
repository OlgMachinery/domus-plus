# 🔧 Solución: Puerto 8000 Ya Está en Uso

## Problema
Error: `[Errno 48] Address already in use`

Esto significa que el puerto 8000 ya está siendo usado por otro proceso.

## Solución 1: Encontrar y Detener el Proceso

### Paso 1: Encontrar qué está usando el puerto 8000

```bash
lsof -i :8000
```

Esto mostrará algo como:
```
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
Python  12345 user   3u  IPv4  ...      0t0  TCP *:8000 (LISTEN)
```

### Paso 2: Detener el proceso

Usa el PID (número) que apareció y ejecuta:

```bash
kill -9 PID
```

Por ejemplo, si el PID es 12345:
```bash
kill -9 12345
```

### Paso 3: Iniciar el servidor de nuevo

```bash
uvicorn app.main:app --reload
```

## Solución 2: Usar Otro Puerto

Si no puedes detener el proceso, usa otro puerto:

```bash
uvicorn app.main:app --reload --port 8001
```

**IMPORTANTE**: Si usas otro puerto, también necesitas actualizar el frontend:

1. Crea o edita `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

2. Reinicia el frontend

## Solución 3: Verificar si Ya Está Corriendo

Es posible que el backend ya esté corriendo en otra terminal. Verifica:

1. Abre http://localhost:8000/health en tu navegador
2. Si ves `{"status":"ok"}`, el backend ya está corriendo
3. No necesitas iniciarlo de nuevo

## ✅ Verificar que Funciona

Después de solucionar el problema:

1. El servidor debería iniciar sin errores
2. Abre http://localhost:8000/health
3. Deberías ver: `{"status":"ok"}`
4. Intenta registrarte de nuevo en http://localhost:3000/register

