# Configuración de WhatsApp con Twilio para DOMUS+

Esta guía te ayudará a configurar la integración de WhatsApp usando Twilio para que los usuarios puedan enviar recibos directamente por WhatsApp.

## Requisitos Previos

1. Cuenta de Twilio (puedes crear una en https://www.twilio.com/)
2. Número de WhatsApp Business configurado en Twilio
3. Backend de DOMUS+ corriendo y accesible desde internet (para el webhook)

## Paso 1: Obtener Credenciales de Twilio

1. Ve a tu consola de Twilio: https://console.twilio.com/
2. En el dashboard, encontrarás:
   - **Account SID**: Identificador de tu cuenta
   - **Auth Token**: Token de autenticación (manténlo secreto)
3. Ve a **Messaging** → **Try it out** → **Send a WhatsApp message**
4. Copia tu **número de WhatsApp de Twilio** (formato: `whatsapp:+14155238886`)

## Paso 2: Configurar Variables de Entorno

Edita el archivo `.env` en el directorio `backend/`:

```bash
cd backend
nano .env  # o usa tu editor preferido
```

Agrega o actualiza estas variables:

```env
TWILIO_ACCOUNT_SID=tu-account-sid-aqui
TWILIO_AUTH_TOKEN=tu-auth-token-aqui
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

**⚠️ IMPORTANTE**: Reemplaza los valores con tus credenciales reales de Twilio.

## Paso 3: Instalar Dependencias

Asegúrate de tener Twilio instalado:

```bash
cd backend
source venv/bin/activate
pip install twilio
```

## Paso 4: Configurar el Webhook en Twilio

### Opción A: Desarrollo Local (usando ngrok)

Si estás desarrollando localmente, necesitas exponer tu servidor local a internet:

1. **Instala ngrok**: https://ngrok.com/download
2. **Inicia tu backend**:
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
3. **Expón tu servidor con ngrok**:
   ```bash
   ngrok http 8000
   ```
4. **Copia la URL HTTPS** que ngrok te da (ejemplo: `https://abc123.ngrok.io`)

### Opción B: Servidor en Producción

Si tu servidor ya está en producción, usa la URL de tu dominio.

### Configurar el Webhook

1. Ve a la consola de Twilio: https://console.twilio.com/
2. Ve a **Messaging** → **Settings** → **WhatsApp Sandbox** (o **WhatsApp Business** si tienes cuenta aprobada)
3. En **A MESSAGE COMES IN**, configura:
   - **URL del Webhook**: `https://tu-dominio.com/api/whatsapp/webhook` o `https://abc123.ngrok.io/api/whatsapp/webhook`
   - **Método**: POST
4. Guarda los cambios

## Paso 5: Verificar la Configuración

Ejecuta el script de verificación:

```bash
cd backend
source venv/bin/activate
python3 verificar_whatsapp.py
```

Este script verificará:
- ✅ Que Twilio esté instalado
- ✅ Que las credenciales estén configuradas
- ✅ Que el cliente de Twilio se pueda inicializar
- ✅ Que el webhook esté configurado correctamente

## Paso 6: Probar la Integración

### 1. Registrar un Usuario con Número de Teléfono

Asegúrate de que los usuarios tengan su número de teléfono registrado en el formato correcto:
- Formato internacional: `+525551234567` (México)
- Incluye el código de país (+52 para México)

### 2. Enviar un Recibo por WhatsApp

1. Envía un mensaje de WhatsApp a tu número de Twilio
2. Adjunta una imagen de recibo
3. El sistema debería:
   - Identificar al usuario por su número de teléfono
   - Procesar la imagen con GPT-4 Vision
   - Crear la transacción automáticamente
   - Responder con confirmación

### 3. Verificar en el Dashboard

Ve a la página de Transacciones en el dashboard web y verifica que la transacción se haya creado correctamente.

## Comandos Disponibles por WhatsApp

Los usuarios pueden enviar estos comandos por WhatsApp:

- **`saldo`** o **`balance`**: Ver sus presupuestos y saldos disponibles
- **Imagen de recibo**: Procesar automáticamente el recibo

## Solución de Problemas

### Error: "No estás registrado en DOMUS+"

**Causa**: El número de teléfono no coincide con el registrado.

**Solución**:
1. Verifica que el número esté registrado en el formato internacional (ej: `+525551234567`)
2. Verifica que el número en Twilio coincida exactamente con el registrado
3. Revisa los logs del backend para ver qué número está recibiendo

### Error: "WhatsApp integration not available"

**Causa**: Twilio no está instalado o las dependencias faltan.

**Solución**:
```bash
cd backend
source venv/bin/activate
pip install twilio
```

### Error: "Error al procesar el recibo"

**Causa**: Problema con GPT-4 Vision o la API key de OpenAI.

**Solución**:
1. Verifica que `OPENAI_API_KEY` esté configurada en `.env`
2. Ejecuta `python3 verificar_gpt_vision.py` para verificar la configuración

### El webhook no recibe mensajes

**Causa**: El webhook no está configurado correctamente o el servidor no es accesible.

**Solución**:
1. Verifica que el backend esté corriendo
2. Verifica que la URL del webhook en Twilio sea correcta
3. Si usas ngrok, asegúrate de que esté corriendo y actualiza la URL en Twilio
4. Revisa los logs del backend para ver si llegan las peticiones

## Notas Importantes

1. **Sandbox de Twilio**: Si estás usando el sandbox de Twilio, solo los números autorizados pueden enviar mensajes. Agrega números de prueba en la consola de Twilio.

2. **Producción**: Para usar en producción, necesitas:
   - Cuenta de WhatsApp Business aprobada por Twilio
   - Número de WhatsApp Business verificado
   - Dominio con SSL (HTTPS) para el webhook

3. **Seguridad**: 
   - Nunca compartas tus credenciales de Twilio
   - Mantén el archivo `.env` fuera del control de versiones
   - Usa variables de entorno en producción

## Soporte

Si tienes problemas, revisa:
- Los logs del backend: `tail -f logs/app.log` (si configuraste logging)
- La consola de Twilio para ver los mensajes recibidos
- Los logs de ngrok si estás en desarrollo local
