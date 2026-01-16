# ✅ Instalar email-validator

## Problema
Falta el módulo `email-validator` que es necesario para validar emails en Pydantic.

## Solución

Ejecuta este comando (ya tienes el entorno virtual activado):

```bash
pip install email-validator
```

O instala pydantic con soporte de email:

```bash
pip install 'pydantic[email]'
```

## Después de Instalar

Reinicia el servidor:

```bash
uvicorn app.main:app --reload
```

Deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

## ✅ Verificar

Abre en tu navegador:
- http://localhost:8000/health
- Debería mostrar: `{"status":"ok"}`

## 🎯 Probar el Registro

1. Ve a http://localhost:3000/register
2. Llena el formulario
3. ¡Debería funcionar ahora!

