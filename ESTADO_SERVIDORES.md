# ✅ Estado de los Servidores DOMUS+

## 📊 Verificación Completa

### ✅ Backend (Puerto 8000)
- **Estado:** ✅ CORRIENDO
- **PID:** 22543
- **Health Check:** ✅ OK
- **URL:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

### ✅ Frontend (Puerto 3000)
- **Estado:** ✅ CORRIENDO
- **PID:** 16481, 23563
- **HTTP Status:** ✅ 200 OK
- **URL:** http://localhost:3000

### ✅ Base de Datos
- **Estado:** ✅ EXISTE
- **Tamaño:** 72K
- **Ubicación:** `backend/domus_plus.db`

### ✅ Entorno Virtual
- **Estado:** ✅ EXISTE
- **Ubicación:** `backend/venv`

### ✅ Dependencias Frontend
- **Estado:** ✅ INSTALADAS
- **Ubicación:** `frontend/node_modules`

## 🧪 Próximos Pasos para Probar Twilio

### 1. Prueba Local (Sin WhatsApp Real)

```bash
cd backend
source venv/bin/activate
python3 probar_mensaje_confirmacion.py
```

Este script verificará que el webhook retorne mensajes de confirmación correctamente.

### 2. Prueba Real con WhatsApp

1. **Verifica que tu número esté registrado en DOMUS+**
   - Inicia sesión en http://localhost:3000
   - Verifica tu número de teléfono

2. **Conecta tu número al Sandbox de Twilio**
   - Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
   - Envía un mensaje a: `+1 415 523 8886`
   - Escribe: `join [código]` (el código que aparece en la página)

3. **Envía un mensaje de prueba**
   - Abre WhatsApp
   - Envía a: `+1 415 523 8886`
   - Opciones:
     - Escribe: `saldo` → Recibirás tus presupuestos
     - Envía foto de recibo → Recibirás confirmación con detalles
     - Escribe cualquier texto → Recibirás mensaje de ayuda

## 📝 Comandos Útiles

### Verificar Estado de Servidores
```bash
./verificar_servidores.sh
```

### Reiniciar Servidores
```bash
./reiniciar_servidores.sh
```

### Ver Logs del Backend
```bash
tail -f /tmp/domus_backend.log
```

### Ver Logs del Frontend
```bash
tail -f /tmp/domus_frontend.log
```

### Detener Servidores
```bash
# Detener Backend
kill $(lsof -ti :8000)

# Detener Frontend
kill $(lsof -ti :3000)
```

## 🔍 Verificación de Webhook de Twilio

Para que Twilio funcione correctamente, necesitas:

1. **ngrok corriendo** (si estás en desarrollo local)
   ```bash
   ngrok http 8000
   ```

2. **Webhook configurado en Twilio**
   - URL: `https://tu-url-ngrok.ngrok.io/api/whatsapp/webhook`
   - Método: POST

3. **Credenciales de Twilio en `.env`**
   ```env
   TWILIO_ACCOUNT_SID=tu_account_sid
   TWILIO_AUTH_TOKEN=tu_auth_token
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   ```

## ✅ Todo Listo

Todos los servidores están corriendo correctamente y listos para recibir mensajes de WhatsApp.

**Fecha de verificación:** $(date)
