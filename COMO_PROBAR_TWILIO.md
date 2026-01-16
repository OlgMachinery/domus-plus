# 🧪 Cómo Probar los Mensajes de Confirmación de Twilio

## 📋 Método 1: Prueba Local (Sin WhatsApp Real)

### Paso 1: Asegúrate de que el servidor esté corriendo

```bash
# Verificar que el backend esté corriendo
curl http://localhost:8000/health
```

Debe responder: `{"status":"ok"}`

### Paso 2: Ejecutar el script de prueba

```bash
cd backend
source venv/bin/activate
python3 probar_mensaje_confirmacion.py
```

Este script probará:
- ✅ Mensaje de texto (comando "saldo")
- ✅ Mensaje sin imagen
- ✅ Usuario no registrado

**Qué verificar:**
- Status Code debe ser `200`
- Content-Type debe ser `text/xml`
- La respuesta debe contener `<Message>...</Message>`
- El mensaje dentro debe ser legible

## 📱 Método 2: Prueba Real con WhatsApp

### Paso 1: Verificar que tu número esté registrado

1. Inicia sesión en DOMUS+ (http://localhost:3000)
2. Ve a tu perfil o dashboard
3. Verifica que tu número de teléfono esté registrado
4. El número debe estar en formato internacional: `+525551234567`

### Paso 2: Conectar tu número al Sandbox de Twilio

1. Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
2. Verás un código como: `join page-desk`
3. Envía un mensaje de WhatsApp desde tu teléfono a: `+1 415 523 8886`
4. Envía el mensaje: `join page-desk`
5. Deberías recibir una confirmación de Twilio

### Paso 3: Verificar que el webhook esté configurado

1. En la misma página de Twilio (WhatsApp Sandbox)
2. En la sección **"A MESSAGE COMES IN"**:
   - Debe tener una URL (ej: `https://tu-url.ngrok.io/api/whatsapp/webhook`)
   - Método: POST
3. Si no está configurado, configúralo ahora

### Paso 4: Enviar un mensaje de prueba

**Opción A: Mensaje de texto**
1. Abre WhatsApp en tu teléfono
2. Envía un mensaje a: `+1 415 523 8886`
3. Escribe: `saldo`
4. Deberías recibir un mensaje con tus presupuestos

**Opción B: Imagen de recibo**
1. Abre WhatsApp en tu teléfono
2. Envía un mensaje a: `+1 415 523 8886`
3. Adjunta una foto de un recibo
4. Deberías recibir un mensaje de confirmación con los detalles del recibo

**Opción C: Mensaje simple**
1. Abre WhatsApp en tu teléfono
2. Envía un mensaje a: `+1 415 523 8886`
3. Escribe cualquier texto
4. Deberías recibir un mensaje de ayuda

## 🔍 Cómo Verificar que Funciona

### 1. Ver los logs del backend

Cuando envíes un mensaje, deberías ver en la terminal del backend:

```
📱 Recibiendo mensaje de WhatsApp desde: +525551234567
✅ Usuario encontrado: Tu Nombre (tu@email.com)
📨 Mensaje recibido - Body: saldo, MediaUrl0: None
📤 Enviando respuesta TwiML a Twilio:
   <?xml version="1.0" encoding="UTF-8"?><Response><Message>...</Message></Response>
   Content-Type: text/xml
```

### 2. Verificar en Twilio

1. Ve a: https://console.twilio.com/
2. Messaging → Logs
3. Busca las peticiones al webhook
4. Verifica que el Status Code sea `200`
5. Revisa la respuesta del webhook

### 3. Verificar en WhatsApp

- Deberías recibir un mensaje de respuesta en WhatsApp
- El mensaje debe ser relevante a lo que enviaste

## ❌ Problemas Comunes

### "No recibo mensaje de confirmación"

**Causas posibles:**
1. El webhook no está configurado en Twilio
2. El servidor no es accesible desde internet (necesitas ngrok)
3. Tu número no está registrado en DOMUS+
4. El backend no está corriendo

**Solución:**
1. Verifica que el backend esté corriendo
2. Si estás en local, inicia ngrok: `ngrok http 8000`
3. Actualiza la URL del webhook en Twilio con la URL de ngrok
4. Verifica que tu número esté registrado en DOMUS+

### "Recibo error 404"

**Causa:** La URL del webhook está mal configurada

**Solución:**
- Verifica que la URL sea: `https://tu-url/api/whatsapp/webhook`
- Debe terminar en `/api/whatsapp/webhook`
- Debe usar HTTPS (no HTTP)

### "Usuario no encontrado"

**Causa:** Tu número no está registrado o está en formato incorrecto

**Solución:**
1. Verifica tu número en DOMUS+
2. Debe estar en formato: `+525551234567` (con código de país)
3. Regístrate si no tienes cuenta

## ✅ Checklist de Verificación

Antes de probar, verifica:

- [ ] Backend corriendo en puerto 8000
- [ ] ngrok corriendo (si estás en desarrollo local)
- [ ] Webhook configurado en Twilio con la URL correcta
- [ ] Tu número registrado en DOMUS+ con formato correcto
- [ ] Tu número conectado al sandbox de Twilio (enviaste "join [código]")
- [ ] Credenciales de Twilio configuradas en `.env`

## 🎯 Resultado Esperado

Cuando todo funciona correctamente:

1. **Envías un mensaje por WhatsApp** → `+1 415 523 8886`
2. **El backend recibe el mensaje** → Logs muestran "Recibiendo mensaje..."
3. **El backend procesa el mensaje** → Crea transacción o procesa comando
4. **El backend retorna respuesta XML** → Con el mensaje de confirmación
5. **Twilio recibe la respuesta** → Status 200 en logs de Twilio
6. **Recibes el mensaje en WhatsApp** → Mensaje de confirmación

## 📞 Próximos Pasos

1. Ejecuta: `python3 probar_mensaje_confirmacion.py` (prueba local)
2. Si pasa, prueba con un mensaje real por WhatsApp
3. Verifica los logs del backend para ver el flujo completo
4. Revisa los logs de Twilio para confirmar que recibió la respuesta
