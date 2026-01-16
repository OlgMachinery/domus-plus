# ✅ Verificación de Twilio - Checklist

## ✅ Correcciones Aplicadas

1. **Content-Type correcto**: Todas las respuestas del webhook ahora retornan `text/xml` con el header correcto
2. **Manejo de errores mejorado**: El webhook siempre retorna una respuesta válida, incluso en caso de error
3. **Cálculo de saldo actualizado**: El comando "saldo" ahora incluye ingresos adicionales

## 🧪 Pruebas Realizadas

### 1. Verificar que el servidor esté corriendo:
```bash
curl http://localhost:8000/health
```
Debe responder: `{"status":"ok"}`

### 2. Probar el webhook localmente:
```bash
cd backend
source venv/bin/activate
python3 probar_webhook_twilio.py
```

### 3. Verificar configuración:
```bash
cd backend
source venv/bin/activate
python3 diagnostico_twilio.py
```

## 📋 Checklist de Configuración

- [x] Twilio instalado (`pip install twilio`)
- [ ] Credenciales configuradas en `.env`:
  - [ ] `TWILIO_ACCOUNT_SID`
  - [ ] `TWILIO_AUTH_TOKEN`
  - [ ] `TWILIO_WHATSAPP_NUMBER`
- [ ] Backend corriendo en puerto 8000
- [ ] Webhook configurado en Twilio:
  - [ ] URL: `https://tu-url/api/whatsapp/webhook`
  - [ ] Método: POST
- [ ] Usuario registrado con número de teléfono correcto
- [ ] Número conectado al sandbox de Twilio

## 🔧 Si el Webhook No Funciona

### Verificar logs del backend:
Cuando envíes un mensaje por WhatsApp, deberías ver en los logs:
```
📱 Recibiendo mensaje de WhatsApp desde: +525551234567
✅ Usuario encontrado: Nombre Usuario
📤 Enviando respuesta TwiML: ...
```

### Verificar en Twilio:
1. Ve a: https://console.twilio.com/
2. Messaging → Logs
3. Revisa si hay errores en las peticiones al webhook

### Verificar que el servidor sea accesible:
- Si estás en desarrollo local, usa ngrok:
  ```bash
  ngrok http 8000
  ```
- Copia la URL HTTPS y úsala en la configuración del webhook de Twilio

## ✅ Estado Actual

- ✅ Webhook corregido con Content-Type correcto
- ✅ Manejo de errores mejorado
- ✅ Cálculo de saldo actualizado
- ✅ Scripts de prueba creados

El webhook está listo para recibir mensajes de Twilio.
