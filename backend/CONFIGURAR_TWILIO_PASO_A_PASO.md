# Configuración de Twilio - Paso a Paso

## ✅ Paso 1: Obtener Account SID y Auth Token

1. En la consola de Twilio, haz clic en **"Account Dashboard"** en el menú lateral izquierdo
2. En el dashboard principal verás:
   - **Account SID**: Visible en la parte superior (formato: `AC...`)
   - **Auth Token**: Haz clic en el botón **"Show"** junto a "Auth Token" para revelarlo
3. **Copia ambos valores** - los necesitarás en el siguiente paso

## ✅ Paso 2: Obtener Número de WhatsApp

Ya estás en la página correcta. El número es:
- **Número**: `+1 415 523 8886`
- **Formato para .env**: `whatsapp:+14155238886`

## ✅ Paso 3: Configurar el Webhook

1. En el menú lateral izquierdo, ve a: **Messaging** → **Settings** → **WhatsApp Sandbox**
2. O directamente en la URL: `https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox`
3. En la sección **"A MESSAGE COMES IN"**, configura:
   - **URL**: `https://tu-dominio.com/api/whatsapp/webhook`
     - Si estás en desarrollo local, usa ngrok: `https://abc123.ngrok.io/api/whatsapp/webhook`
   - **Método**: `POST`
4. Haz clic en **"Save"**

## ✅ Paso 4: Conectar tu Número Personal al Sandbox

Para poder recibir mensajes en el sandbox:

1. En la página que tienes abierta, verás el código: `join page-desk`
2. Envía un mensaje de WhatsApp desde tu teléfono a: `+1 415 523 8886`
3. Envía el mensaje: `join page-desk`
4. O escanea el código QR con WhatsApp

## ✅ Paso 5: Configurar en DOMUS+

Ejecuta el script de configuración:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
python3 configurar_twilio_ahora.py
```

Pega las credenciales cuando te las pida.

## 📋 Resumen de Credenciales Necesarias

- **TWILIO_ACCOUNT_SID**: Del dashboard (formato: `AC...`)
- **TWILIO_AUTH_TOKEN**: Del dashboard (haz clic en "Show")
- **TWILIO_WHATSAPP_NUMBER**: `whatsapp:+14155238886`

## 🔗 Enlaces Rápidos

- Dashboard: https://console.twilio.com/
- WhatsApp Sandbox Settings: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
