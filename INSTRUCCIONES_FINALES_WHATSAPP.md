# ✅ Configuración de WhatsApp - Instrucciones Finales

## Estado Actual

✅ **Twilio configurado** - Credenciales guardadas  
✅ **ngrok corriendo** - URL pública activa  
✅ **Backend funcionando** - Servidor en puerto 8000  
✅ **Sandbox conectado** - Ya enviaste "join page-desk"  
✅ **Webhook funcionando** - Endpoint respondiendo correctamente  

## 📋 Último Paso: Configurar Webhook en Twilio

### URL del Webhook:
```
https://reproachably-extremer-laraine.ngrok-free.dev/api/whatsapp/webhook
```

### Pasos:

1. **Ve a la consola de Twilio:**
   - https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
   - O: Messaging → Settings → WhatsApp Sandbox

2. **En la sección "A MESSAGE COMES IN":**
   - Pega la URL de arriba
   - Método: **POST**
   - Haz clic en **"Save"**

## ⚠️ IMPORTANTE: Registrar tu Número en DOMUS+

Para que el sistema te identifique cuando envíes recibos, tu número de teléfono debe estar registrado en DOMUS+.

### Formato del Número:

El número debe estar en formato internacional:
- ✅ Correcto: `+525551234567` (México)
- ✅ Correcto: `+14155238886` (USA)
- ❌ Incorrecto: `5551234567` (sin código de país)
- ❌ Incorrecto: `525551234567` (sin el signo +)

### Cómo Verificar/Actualizar:

1. **Inicia sesión en DOMUS+** (http://localhost:3000)
2. **Ve a tu perfil** o verifica tu número registrado
3. **Si necesitas actualizarlo**, edítalo para que incluya el código de país con el signo `+`

### Ejemplo:

Si tu número es `5551234567` en México, debe registrarse como: `+525551234567`

## 🧪 Prueba Final

Una vez configurado el webhook y verificado tu número:

1. **Envía una imagen de recibo** por WhatsApp a: `+1 415 523 8886`
2. **El sistema debería:**
   - Identificarte por tu número de teléfono
   - Procesar la imagen con GPT-4 Vision
   - Extraer automáticamente: fecha, monto, comercio, categoría, etc.
   - Crear la transacción en DOMUS+
   - Responderte con confirmación por WhatsApp

## 📊 Ver Resultados

Después de enviar el recibo:
- Ve a http://localhost:3000/transactions
- Deberías ver la nueva transacción creada automáticamente

## 🔧 Solución de Problemas

### "No estás registrado en DOMUS+"

**Causa**: Tu número no está en la base de datos o el formato no coincide.

**Solución**:
1. Verifica que tu número esté registrado en DOMUS+
2. Asegúrate de que tenga el formato internacional con `+`
3. El número debe coincidir exactamente con el que envías desde WhatsApp

### El webhook no recibe mensajes

**Causa**: El webhook no está configurado en Twilio o la URL es incorrecta.

**Solución**:
1. Verifica que el webhook esté configurado en Twilio
2. Si reiniciaste ngrok, obtén la nueva URL: `python3 obtener_url_ngrok.py`
3. Actualiza la URL en Twilio

### ngrok se detuvo

**Solución**:
```bash
cd /Users/gonzalomontanofimbres/domus-plus
~/bin/ngrok http 8000
```

O ejecuta:
```bash
./instalar_y_configurar_ngrok.sh
```

## 📝 Notas

- **URL de ngrok**: Cambia cada vez que reinicias ngrok
- **Sandbox de Twilio**: Solo funciona con números autorizados
- **Producción**: Para producción, necesitas una cuenta de WhatsApp Business aprobada
