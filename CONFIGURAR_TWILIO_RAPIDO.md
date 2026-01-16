# Configuración Rápida de Twilio

## Opción 1: Script Automatizado (Recomendado)

```bash
cd backend
./configurar_twilio.sh
```

O usando Python:

```bash
cd backend
source venv/bin/activate
python3 obtener_credenciales_twilio.py
```

Este script te guiará paso a paso y abrirá la consola de Twilio automáticamente.

## Opción 2: Manual

1. **Obtén tus credenciales**:
   - Ve a: https://console.twilio.com/
   - Account SID: Visible en el dashboard
   - Auth Token: Haz clic en "Show" para revelarlo
   - WhatsApp Number: Messaging → Settings → WhatsApp Sandbox

2. **Configura en `.env`**:
   ```bash
   cd backend
   nano .env
   ```
   
   Agrega:
   ```env
   TWILIO_ACCOUNT_SID=tu-account-sid-aqui
   TWILIO_AUTH_TOKEN=tu-auth-token-aqui
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

3. **Verifica**:
   ```bash
   python3 verificar_whatsapp.py
   ```

## Configurar Webhook

1. Ve a: https://console.twilio.com/
2. Messaging → Settings → WhatsApp Sandbox
3. En "A MESSAGE COMES IN":
   - URL: `https://tu-dominio.com/api/whatsapp/webhook`
   - Método: POST
4. Guarda

**Para desarrollo local**, usa ngrok:
```bash
ngrok http 8000
# Usa la URL HTTPS que ngrok te da
```

## Prueba Rápida

```bash
# Verificar configuración
python3 verificar_whatsapp.py

# Probar envío de mensaje
python3 probar_whatsapp.py
```
