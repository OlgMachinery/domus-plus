# A qué número mandar WhatsApp para probar DOMUS

## Cómo funciona

Tú **envías un mensaje de WhatsApp al número de Twilio**. Twilio recibe ese mensaje y lo reenvía a la URL del webhook de DOMUS (por ejemplo `https://domus-fam.com/api/whatsapp/webhook`). DOMUS procesa el mensaje y responde; Twilio envía esa respuesta de vuelta a tu WhatsApp.

Es decir: **el número al que tú le escribes** es el número de WhatsApp que te da Twilio, no un número de DOMUS.

---

## Dónde ver ese número (Twilio)

1. Entra a la consola de Twilio: **https://console.twilio.com/**
2. Menú **Messaging** → **Try it out** → **Send a WhatsApp message**  
   o bien **Messaging** → **Settings** → **WhatsApp Sandbox**.
3. Ahí verás algo como:
   - **“Send a message to this WhatsApp number”** o
   - Un número en formato **+1 415 523 8886** (ejemplo del sandbox).
4. Ese número es **al que tú mandas el WhatsApp** para probar (desde tu teléfono personal).

En la variable de entorno es el mismo número con prefijo `whatsapp:`:
- Ejemplo: `TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886`

---

## Si usas el Sandbox de Twilio (pruebas)

1. En **WhatsApp Sandbox** te dirán algo como: *“Join xxx-xxxx”* (código de 2 palabras).
2. Desde **tu** WhatsApp, envía exactamente ese mensaje (ej. `join yellow-tiger`) **al número del sandbox**.
3. Twilio te confirma que ya estás unido.
4. A partir de ahí, cualquier mensaje que envíes **a ese mismo número** (fotos de recibos, texto “500 cine Sofía”, etc.) Twilio lo enviará al webhook que tengas configurado.

Resumen: **el número al que mandas la prueba es el número de WhatsApp que muestra Twilio (sandbox o negocio)** en la consola.

---

## Estado en domus-beta-dbe

La ruta **`/api/whatsapp/webhook`** está implementada en domus-beta-dbe.

1. **En Twilio:** URL del webhook = `https://domus-fam.com/api/whatsapp/webhook` (método POST).
2. **En la VPS** (`.env` del servidor): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`. Opcional para fotos de recibo: `OPENAI_API_KEY`, `OPENAI_RECEIPT_MODEL`.
3. **Teléfono en DOMUS:** El usuario debe tener su **teléfono** guardado en el perfil (mismo formato que usa WhatsApp, ej. +52 55 1234 5678) para que el webhook lo identifique.
4. Tú mandas un WhatsApp **al número de Twilio** (el de la consola) y DOMUS recibe, registra y responde (y envía comprobante al destinatario si indicas "500 a Sofía cine").
