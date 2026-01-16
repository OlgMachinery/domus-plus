# ⚡ Comandos Rápidos - Solución Puerto Ocupado

## Problema
El puerto 8000 ya está en uso por otro proceso (PID 83106).

## Solución Rápida

Ejecuta este comando para detener el proceso y reiniciar:

```bash
kill -9 83106
```

Luego inicia el servidor de nuevo:

```bash
uvicorn app.main:app --reload
```

## O Usa Este Comando Directo

```bash
lsof -ti :8000 | xargs kill -9 && uvicorn app.main:app --reload
```

Este comando:
1. Encuentra el proceso en el puerto 8000
2. Lo detiene
3. Inicia el servidor de nuevo

## Verificar que Funciona

Después de ejecutar, deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Luego abre:
- http://localhost:8000/health (debería mostrar `{"status":"ok"}`)
- http://localhost:3000/register (intenta registrarte de nuevo)

