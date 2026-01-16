# 🔍 Diagnóstico: Mensajes de WhatsApp No Llegan

## 🔧 Problemas Corregidos

### 1. Enum TransactionType
- ✅ Cambiado de `SQLEnum` a `String` (mismo problema que BudgetType)
- ✅ Actualizado en `models.py`, `whatsapp.py`, `receipts.py`, `transactions.py`

### 2. Verificación de Mensajes en Webhook
- ✅ Agregada verificación para asegurar que siempre haya un `<Message>` en la respuesta
- ✅ Logging mejorado para diagnosticar problemas
- ✅ Mensaje por defecto si no se envió ninguno

## 🔍 Cómo Diagnosticar

### Ver Logs del Backend en Tiempo Real

```bash
tail -f /tmp/domus_backend.log
```

**Qué buscar:**
- `📱 Recibiendo mensaje de WhatsApp desde: ...`
- `✅ Usuario encontrado: ...`
- `📤 Enviando respuesta TwiML a Twilio:`
- `Contiene <Message>: True`

### Probar el Webhook Localmente

```bash
cd backend
source venv/bin/activate
python3 probar_mensaje_confirmacion.py
```

## ✅ Verificaciones Realizadas

1. ✅ Webhook siempre retorna XML válido
2. ✅ Webhook siempre incluye un `<Message>`
3. ✅ Content-Type correcto: `text/xml`
4. ✅ Headers correctos configurados
5. ✅ Logging detallado agregado

## 🧪 Prueba Ahora

1. **Envía un mensaje por WhatsApp** a: `+1 415 523 8886`
2. **Revisa los logs del backend** para ver el flujo completo
3. **Deberías recibir un mensaje de respuesta** en WhatsApp

## 📊 Logs Esperados

Cuando envíes un mensaje, deberías ver:

```
📱 Recibiendo mensaje de WhatsApp desde: +526865690472
✅ Usuario encontrado: Gonzalo Montano (gonzalomail@me.com)
📨 Mensaje recibido - Body: saldo, MediaUrl0: None
📤 Enviando respuesta TwiML a Twilio:
   Longitud XML: 234 caracteres
   Contiene <Message>: True
   Primeros 200 caracteres: <?xml version="1.0" encoding="UTF-8"?><Response><Message>...
   Content-Type: text/xml
```

Si no ves estos logs, el webhook no está recibiendo los mensajes de Twilio.

## ❌ Si Aún No Funciona

1. **Verifica que ngrok esté corriendo:**
   ```bash
   ps aux | grep ngrok
   ```

2. **Verifica la URL del webhook en Twilio:**
   - Debe ser: `https://tu-url-ngrok.ngrok.io/api/whatsapp/webhook`
   - Método: POST

3. **Verifica los logs de Twilio:**
   - Ve a: https://console.twilio.com/
   - Messaging → Logs
   - Busca las peticiones al webhook
   - Verifica el Status Code (debe ser 200)

4. **Verifica que tu número esté registrado:**
   - Inicia sesión en http://localhost:3000
   - Verifica tu número de teléfono en tu perfil
