# 🔧 Solución: Error de Conexión al Backend

## Problema
El frontend muestra: "No se pudo conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:8000"

## Solución: Iniciar el Backend

El backend **NO está corriendo**. Necesitas iniciarlo.

### Pasos para Iniciar el Backend

1. **Abre una nueva terminal** (deja el frontend corriendo)

2. **Ejecuta estos comandos:**

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
pip install email-validator
uvicorn app.main:app --reload
```

3. **Espera a ver este mensaje:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### Verificar que el Backend Funciona

Abre en tu navegador:
- http://localhost:8000/health
- Deberías ver: `{"status":"ok"}`

### Después de Iniciar el Backend

1. **Vuelve a la página de registro**: http://localhost:3000/register
2. **Intenta registrarte de nuevo**
3. **Debería funcionar ahora**

## ⚠️ Importante

**Necesitas DOS terminales abiertas:**

1. **Terminal 1**: Frontend (ya está corriendo)
   - Debería mostrar: `- Local: http://localhost:3000`

2. **Terminal 2**: Backend (necesitas iniciarlo)
   - Debería mostrar: `INFO: Uvicorn running on http://127.0.0.1:8000`

## ✅ Checklist

- [ ] Backend corriendo en http://localhost:8000
- [ ] Frontend corriendo en http://localhost:3000
- [ ] Puedes ver http://localhost:8000/health y muestra `{"status":"ok"}`
- [ ] Puedes registrarte sin errores

