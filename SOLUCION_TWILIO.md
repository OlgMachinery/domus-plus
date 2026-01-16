# 🔧 Solución: Problemas con Twilio/WhatsApp

## 🔍 Diagnóstico del Problema

Si los mensajes de WhatsApp no llegan desde Twilio, puede ser por varias razones:

### 1. ❌ Twilio no está instalado
**Síntoma:** Error al importar twilio

**Solución:**
```bash
cd backend
source venv/bin/activate
pip install twilio
```

### 2. ❌ Credenciales no configuradas
**Síntoma:** Variables de entorno faltantes

**Solución:**
1. Ve a: https://console.twilio.com/
2. Obtén tus credenciales:
   - Account SID (formato: `AC...`)
   - Auth Token (haz clic en "Show")
   - WhatsApp Number: `whatsapp:+14155238886`
3. Configura en `backend/.env`:
```env
TWILIO_ACCOUNT_SID=tu-account-sid-aqui
TWILIO_AUTH_TOKEN=tu-auth-token-aqui
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 3. ❌ Webhook no configurado en Twilio
**Síntoma:** Twilio no puede enviar mensajes al servidor

**Solución:**
1. **Si estás en desarrollo local:**
   - Instala ngrok: https://ngrok.com/download
   - Ejecuta: `ngrok http 8000`
   - Copia la URL HTTPS que ngrok te da (ejemplo: `https://abc123.ngrok.io`)

2. **Configura el webhook en Twilio:**
   - Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
   - En la sección **"A MESSAGE COMES IN"**:
     - URL: `https://tu-url-ngrok.ngrok.io/api/whatsapp/webhook`
     - Método: **POST**
   - Haz clic en **"Save"**

### 4. ❌ Servidor no accesible desde internet
**Síntoma:** Twilio no puede alcanzar el servidor

**Solución:**
- **Desarrollo local:** Usa ngrok (ver punto 3)
- **Producción:** Asegúrate de que tu servidor tenga una URL pública HTTPS

### 5. ❌ Usuario no registrado
**Síntoma:** El sistema no encuentra al usuario que envía el mensaje

**Solución:**
1. Verifica que el número de teléfono esté registrado en DOMUS+
2. El número debe estar en formato internacional:
   - ✅ Correcto: `+525551234567`
   - ❌ Incorrecto: `5551234567` (sin código de país)
3. Si el número no está registrado:
   - Regístrate en la aplicación web
   - O actualiza tu número de teléfono en tu perfil

### 6. ❌ Backend no está corriendo
**Síntoma:** El webhook no responde

**Solución:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 🧪 Verificación Paso a Paso

### Paso 1: Verificar instalación
```bash
cd backend
source venv/bin/activate
python3 diagnostico_twilio.py
```

### Paso 2: Verificar que el servidor está corriendo
```bash
curl http://localhost:8000/health
```
Debe responder: `{"status":"ok"}`

### Paso 3: Probar el webhook localmente
```bash
curl -X POST http://localhost:8000/api/whatsapp/webhook \
  -d "From=whatsapp:+525551234567" \
  -d "Body=test" \
  -d "MessageSid=test123"
```

### Paso 4: Verificar logs del backend
Cuando envíes un mensaje por WhatsApp, revisa los logs del backend:
```bash
# Deberías ver mensajes como:
📱 Recibiendo mensaje de WhatsApp desde: +525551234567
✅ Usuario encontrado: Nombre Usuario
🖼️ Procesando imagen desde: https://...
```

## 📋 Checklist Completo

- [ ] Twilio instalado (`pip install twilio`)
- [ ] Credenciales configuradas en `.env`
- [ ] Backend corriendo en puerto 8000
- [ ] ngrok corriendo (si estás en desarrollo local)
- [ ] Webhook configurado en Twilio con la URL correcta
- [ ] Usuario registrado con número de teléfono correcto
- [ ] Número conectado al sandbox de Twilio (envía "join [código]")

## 🚨 Problemas Comunes

### "Usuario no encontrado"
- Verifica que el número esté registrado en DOMUS+
- Verifica el formato del número (debe incluir código de país con +)

### "Webhook no responde"
- Verifica que el backend esté corriendo
- Verifica que ngrok esté corriendo (si estás en desarrollo)
- Verifica que la URL del webhook en Twilio sea correcta

### "Error 404 en el webhook"
- Verifica que la ruta sea: `/api/whatsapp/webhook`
- Verifica que el método sea: `POST`
- Verifica que el router esté incluido en `main.py`

## 📞 Próximos Pasos

1. Ejecuta el diagnóstico: `python3 diagnostico_twilio.py`
2. Revisa los logs del backend cuando envíes un mensaje
3. Verifica la configuración del webhook en Twilio
4. Asegúrate de que tu número esté conectado al sandbox
