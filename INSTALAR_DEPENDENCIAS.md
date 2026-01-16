# 📦 Instalar Dependencias - Python 3.13

## Problema
Algunos paquetes antiguos no son compatibles con Python 3.13.

## Solución: Instalar Dependencias Mínimas Primero

Ejecuta estos comandos en orden:

### Paso 1: Instalar dependencias básicas (sin Pillow ni OpenAI)

```bash
pip install -r requirements-minimal.txt
```

Esto instalará las dependencias esenciales para que el servidor funcione.

### Paso 2: Crear la base de datos

```bash
python3 crear_bd.py
```

### Paso 3: Iniciar el servidor

```bash
uvicorn app.main:app --reload
```

## Instalar Dependencias Opcionales Después

Una vez que el servidor funcione, puedes instalar las dependencias opcionales:

```bash
# Para procesamiento de imágenes (opcional)
pip install pillow

# Para OpenAI (opcional, solo si vas a procesar recibos)
pip install openai

# Para WhatsApp (opcional)
pip install twilio httpx
```

## Verificar que Funciona

1. El servidor debería iniciar sin errores
2. Abre http://localhost:8000/health
3. Debería mostrar: `{"status":"ok"}`

## Nota

Las dependencias opcionales (Pillow, OpenAI, Twilio) solo son necesarias para:
- **Pillow**: Procesamiento avanzado de imágenes (no crítico)
- **OpenAI**: Procesamiento automático de recibos con IA
- **Twilio**: Integración con WhatsApp

Para probar el registro básico, **no son necesarias**.

