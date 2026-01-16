# 📦 Instalar Dependencias Faltantes

## Problema
El servidor no puede iniciar porque faltan módulos:
- `twilio` (para WhatsApp)
- `openai` (para procesar recibos)

## Solución

En la terminal donde tienes el backend (con `(venv)` activado), ejecuta:

```bash
pip install twilio openai
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

## ⚠️ Nota

Estas dependencias son opcionales para el funcionamiento básico:
- **twilio**: Solo necesario si vas a usar la integración de WhatsApp
- **openai**: Solo necesario si vas a procesar recibos con IA

Si quieres que el servidor funcione sin estas dependencias, puedes hacer los imports opcionales en el código.

