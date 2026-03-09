# Verificación: integración Twilio / WhatsApp

## Dónde está integrado Twilio

La integración **sí existe** en el repositorio, en la **app principal** (raíz del repo y/o `frontend/`), **no** en la app que se despliega a la VPS (`domus-beta-dbe`).

### 1. App con Supabase (raíz / frontend)

| Componente | Ubicación | Función |
|-----------|-----------|---------|
| **Webhook WhatsApp** | `app/api/whatsapp/webhook/route.ts` y `frontend/app/api/whatsapp/webhook/route.ts` | Recibe mensajes de Twilio (POST), descarga imagen con credenciales Twilio, procesa recibo con OpenAI, guarda transacción en Supabase, responde TwiML. |
| **Servicio envío** | `lib/services/whatsapp-service.ts` y `frontend/lib/services/whatsapp-service.ts` | `sendWhatsAppMessage(to, message)` usando el cliente Twilio. |
| **Dependencia** | `package.json` (raíz y frontend) | `"twilio": "^5.5.0"` |

**Variables de entorno usadas:**

- `TWILIO_ACCOUNT_SID` – para cliente y auth al descargar medios.
- `TWILIO_AUTH_TOKEN` – igual.
- `TWILIO_WHATSAPP_NUMBER` – número desde el que se envía (ej. `whatsapp:+14155238886`).

**Otros requisitos del webhook:**

- Supabase: `users` con `phone`, `transactions` con `whatsapp_message_id` / `whatsapp_phone`.
- OpenAI: `OPENAI_API_KEY` para OCR del recibo.

### 2. App desplegada en VPS: domus-beta-dbe

- **No** incluye rutas ni código de Twilio/WhatsApp.
- **No** tiene la dependencia `twilio` en `package.json`.
- El modelo `User` en Prisma **sí tiene** `phone` (opcional), por si más adelante se añade WhatsApp ahí.

---

## Checklist de verificación (app con Supabase)

Para que Twilio/WhatsApp funcione en la app donde sí está el webhook:

1. **Variables de entorno**
   - [ ] `TWILIO_ACCOUNT_SID` definido.
   - [ ] `TWILIO_AUTH_TOKEN` definido.
   - [ ] `TWILIO_WHATSAPP_NUMBER` con formato `whatsapp:+...`.

2. **Twilio Console**
   - [ ] Webhook de WhatsApp apuntando a la URL pública del webhook, ej.:  
     `https://tu-dominio.com/api/whatsapp/webhook`
   - [ ] En sandbox: número de prueba unido con "join &lt;codigo&gt;".

3. **App**
   - [ ] Usuarios con `phone` (o equivalente) para identificar quién envía por WhatsApp.
   - [ ] `OPENAI_API_KEY` si el webhook procesa imágenes de recibos con OpenAI.

4. **Probar**
   - [ ] `GET https://tu-dominio.com/api/whatsapp/webhook` → responde algo tipo `{ "status": "WhatsApp webhook is active" }`.
   - [ ] Enviar imagen de recibo por WhatsApp al número de Twilio y comprobar que se crea transacción y se responde mensaje.

---

## Si quieres Twilio también en domus-beta-dbe (VPS)

Habría que:

1. Añadir `twilio` (y si aplica `openai`) a `domus-beta-dbe/package.json`.
2. Crear en domus-beta-dbe algo equivalente a:
   - `src/app/api/whatsapp/webhook/route.ts`
   - Servicio de envío (opcional) para notificaciones.
3. Adaptar la lógica a **Prisma/SQLite**: buscar usuario por `User.phone`, crear `Transaction` y opcionalmente `Receipt` + `ReceiptImage` en lugar de tablas Supabase.
4. Definir en el servidor (y en el script de deploy) las variables `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` (y `OPENAI_API_KEY` si se usa OCR).

Si quieres, el siguiente paso puede ser esbozar o implementar el webhook y el flujo de recibo por WhatsApp dentro de `domus-beta-dbe`.
