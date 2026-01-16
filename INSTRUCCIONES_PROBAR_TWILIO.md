# 🧪 Instrucciones para Probar los Mensajes de Confirmación de Twilio

## ✅ Estado Actual

**Todos los servidores están corriendo correctamente:**
- ✅ Backend: http://localhost:8000
- ✅ Frontend: http://localhost:3000
- ✅ Base de datos: Existe y funcionando
- ✅ Webhook de Twilio: Configurado y listo

## 📋 Cómo Probar

### Opción 1: Prueba Local (Recomendado Primero)

Ejecuta el script de prueba local para verificar que el código funciona:

```bash
cd backend
source venv/bin/activate
python3 probar_mensaje_confirmacion.py
```

**Qué verificar:**
- ✅ Status Code: 200
- ✅ Content-Type: text/xml
- ✅ La respuesta contiene `<Message>...</Message>`
- ✅ Solo se envía UN mensaje (no dos)

### Opción 2: Prueba Real con WhatsApp

**Requisitos previos:**
1. Tu número registrado en DOMUS+ (formato: `+525551234567`)
2. Tu número conectado al Sandbox de Twilio
3. ngrok corriendo (si estás en desarrollo local)
4. Webhook configurado en Twilio con la URL de ngrok
5. Credenciales de Twilio en `backend/.env`

**Pasos:**

1. **Inicia ngrok** (si estás en local):
   ```bash
   ngrok http 8000
   ```
   Copia la URL HTTPS (ej: `https://abc123.ngrok.io`)

2. **Configura el webhook en Twilio:**
   - Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
   - En "A MESSAGE COMES IN", pega: `https://tu-url-ngrok.ngrok.io/api/whatsapp/webhook`
   - Método: POST
   - Guarda los cambios

3. **Conecta tu número al Sandbox:**
   - En la misma página de Twilio, verás un código como: `join page-desk`
   - Abre WhatsApp en tu teléfono
   - Envía un mensaje a: `+1 415 523 8886`
   - Escribe: `join [código]` (reemplaza [código] con el código que aparece)
   - Deberías recibir una confirmación de Twilio

4. **Envía un mensaje de prueba:**
   - Abre WhatsApp
   - Envía mensaje a: `+1 415 523 8886`
   - **Opciones:**
     - Escribe: `saldo` → Deberías recibir tus presupuestos
     - Envía foto de recibo → Deberías recibir confirmación con detalles
     - Escribe cualquier texto → Deberías recibir mensaje de ayuda

## 🔍 Cómo Verificar que Funciona

### 1. Ver los Logs del Backend

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
- Debe llegar en segundos (no minutos)

## ❌ Problemas Comunes

### "No recibo mensaje de confirmación"

**Causas posibles:**
1. El webhook no está configurado en Twilio
2. El servidor no es accesible desde internet (necesitas ngrok)
3. Tu número no está registrado en DOMUS+
4. El backend no está corriendo

**Solución:**
1. Verifica que el backend esté corriendo: `curl http://localhost:8000/health`
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
