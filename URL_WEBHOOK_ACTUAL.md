# 🔗 URL del Webhook para Twilio

## 📋 URL Completa

```
https://reproachably-extremer-laraine.ngrok-free.dev/api/whatsapp/webhook
```

**Método:** `POST`

## 📍 Dónde Configurarla en Twilio

1. **Ve a la consola de Twilio:**
   - https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox

2. **En la sección "A MESSAGE COMES IN":**
   - Pega la URL de arriba
   - Selecciona método: **POST**
   - Haz clic en **"Save"**

## ✅ Verificación

- ✅ ngrok está corriendo
- ✅ Backend está corriendo en puerto 8000
- ✅ URL pública activa: `https://reproachably-extremer-laraine.ngrok-free.dev`

## ⚠️ Importante

Esta URL es **temporal** y cambiará si reinicias ngrok.

Si reinicias ngrok, ejecuta:
```bash
python3 obtener_url_ngrok.py
```

Esto te dará la nueva URL para actualizar en Twilio.
