# ⚡ Prueba Rápida: Mensajes de Confirmación de Twilio

## 🚀 Prueba en 3 Pasos

### Paso 1: Verificar que el servidor esté corriendo

```bash
curl http://localhost:8000/health
```

**Resultado esperado:** `{"status":"ok"}`

### Paso 2: Ejecutar prueba local

```bash
cd backend
source venv/bin/activate
python3 probar_mensaje_confirmacion.py
```

**Qué buscar:**
- ✅ Status Code: 200
- ✅ Content-Type: text/xml
- ✅ La respuesta contiene `<Message>...</Message>`
- ✅ El mensaje es legible

### Paso 3: Prueba real con WhatsApp

1. **Abre WhatsApp** en tu teléfono
2. **Envía mensaje a:** `+1 415 523 8886`
3. **Escribe:** `saldo` o envía una foto de recibo
4. **Espera respuesta** (debería llegar en segundos)

## ✅ Si Funciona Correctamente

**Verás en los logs del backend:**
```
📱 Recibiendo mensaje de WhatsApp desde: +525551234567
✅ Usuario encontrado: Tu Nombre
📤 Enviando respuesta TwiML a Twilio:
   <?xml version="1.0" encoding="UTF-8"?><Response><Message>...</Message></Response>
```

**Recibirás en WhatsApp:**
- Un mensaje de confirmación con los detalles del recibo procesado
- O un mensaje con tus presupuestos (si enviaste "saldo")
- O un mensaje de ayuda (si enviaste otro texto)

## ❌ Si No Funciona

1. **Verifica que el backend esté corriendo**
2. **Verifica que ngrok esté corriendo** (si estás en local)
3. **Verifica la URL del webhook en Twilio**
4. **Verifica que tu número esté registrado en DOMUS+**

Para más detalles, lee: `COMO_PROBAR_TWILIO.md`
