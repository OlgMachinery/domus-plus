# Plan: Recibir recibos, procesar y enviar comprobante + registro (DOMUS)

## Idea general

1. **Usuario envía** → Por WhatsApp (o luego en app): "500 pesos cine Sofía" o una foto de recibo.
2. **DOMUS recibe** → Registra la transacción (quién pagó, monto, categoría, destinatario/entidad) y **genera un código de registro**.
3. **DOMUS envía al destinatario** → **El mismo comprobante más el registro**: comprobante (prueba del movimiento) + **código de registro** (referencia única para consultar o auditar en DOMUS).

Así el que paga queda registrado, el que recibe tiene **comprobante y código de registro** (no solo el comprobante), y todo es auditable.

---

## Código de registro (estilo aeronáutico)

Para que cada transacción tenga una **referencia única** que se pueda citar, buscar y mostrar en el comprobante:

- **Formato:** `E-XXXX` o `I-XXXX` (4 letras mayúsculas A–Z).
- **Primera letra (prefijo):**
  - **E** = **E**greso (gasto, salida de dinero).
  - **I** = **I**ngreso (entrada de dinero).
- **Las 4 letras:** combinación única (ej. `E-AK7B` no, solo letras → `E-XYZA`). Con 26 letras: 26^4 = **456.976 códigos por tipo** (E o I). Por familia da margen de sobra (miles de transacciones al año).
- **Unicidad:** por familia: `(familyId, registrationCode)` único. Otra familia puede repetir el mismo código.

**Ejemplo de mensaje al destinatario (Sofía):**  
"Comprobante DOMUS: [Mamá] registró $500 – Cine. **Registro: E-XKJM**. Consulta en la app."

Ventajas: auditable, referenciable, se puede buscar por código en la app o en soporte; el prefijo E/I deja claro si es ingreso o egreso sin abrir el detalle.

---

## Flujos concretos

### A) Mensaje de texto (ej. WhatsApp)

- **Entrada:** "500 cine Sofía" o "Transferí 500 a Sofía para cine".
- **DOMUS:** Parsea monto, concepto/categoría, destinatario (por nombre o entidad).
- **Registro:** Crea transacción (usuario que envía = quien pagó; asignación/entidad según Sofía; categoría Cine/Entretenimiento).
- **Salida:** Mensaje a Sofía por WhatsApp (o email): "Comprobante: [Nombre] te registró $500 – Cine. Ver en DOMUS."

### B) Foto de recibo (WhatsApp)

- **Entrada:** Imagen de recibo (ticket, transferencia, etc.).
- **DOMUS:** OCR (OpenAI), extrae monto, fecha, comercio; opcionalmente asocia a una entidad o pide "¿Para quién?".
- **Registro:** Transaction + Receipt + ReceiptImage; si hay destinatario, se asocia.
- **Salida:** Comprobante al destinatario (si tiene teléfono/email) y confirmación al que envió.

### C) Transferencia "a través de DOMUS" (futuro)

- **Entrada:** En la app: "Enviar $500 a Sofía – Cine".
- **DOMUS:** Crea la transacción y opcionalmente marca como "transferencia interna".
- **Salida:** Notificación/comprobante a Sofía automáticamente.

---

## Qué aporta

- **Un solo lugar:** Todo queda registrado en DOMUS (quién pagó, quién recibió, concepto).
- **Comprobante automático:** El beneficiario (Sofía) recibe prueba sin tener que pedirla.
- **Menos fricción:** Envío por WhatsApp + respuesta con comprobante reduce pasos manuales.
- **Auditable:** Historial claro para la familia.

---

## Piezas técnicas (domus-beta-dbe)

| Pieza | Descripción |
|-------|-------------|
| **1. Webhook WhatsApp** | `POST /api/whatsapp/webhook`: recibe mensajes de Twilio (texto o imagen). |
| **2. Identificar usuario** | Por `User.phone` (normalizado) saber quién envía. |
| **3. Parser texto** | Si es texto: extraer monto, concepto, destinatario (nombres o entidades de la familia). |
| **4. OCR imagen** | Si es imagen: OpenAI (o similar) → monto, fecha, comercio; preguntar o inferir destinatario si hace falta. |
| **5. Crear registro** | Transaction (+ Receipt + ReceiptImage si hay foto). Asignación según categoría y entidad (ej. Sofía). |
| **6. Enviar comprobante + registro** | Al destinatario: comprobante + **código de registro** (ej. "Registro: E-XKJM"). Si tiene `phone`, por Twilio. |
| **7. Respuesta al remitente** | TwiML: "Registrado $500 Cine – Código E-XKJM. Comprobante enviado a Sofía." |

---

## Orden sugerido de implementación

1. **Twilio en domus-beta-dbe**  
   - Añadir dependencia `twilio`.  
   - Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`.

2. **Webhook WhatsApp (solo texto)**  
   - Recibir mensaje, identificar usuario por teléfono.  
   - Respuesta fija tipo: "DOMUS recibió tu mensaje. Próximamente: registrar y enviar comprobante."

3. **Parser de texto**  
   - Reglas simples: "500 cine Sofía" → monto 500, categoría Entretenimiento/Cine, destinatario = usuario/entidad "Sofía".  
   - Resolver destinatario con nombres de la familia (FamilyMember + User name) o entidades (BudgetEntity).

4. **Crear transacción desde mensaje**  
   - Con monto, categoría, entidad/destinatario, usuario que envía.  
   - Respuesta al remitente: "Registrado $500 Cine para Sofía."

5. **Enviar comprobante al destinatario**  
   - Buscar usuario/contacto "Sofía" con `phone`; si existe, enviar por Twilio: "Comprobante: [Remitente] registró $500 – Cine. DOMUS."

6. **Soporte imagen (foto de recibo)**  
   - Descargar imagen (auth Twilio), OCR, crear Transaction + Receipt + ReceiptImage.  
   - Opción: preguntar "¿Para quién?" si no se puede inferir; luego enviar comprobante igual.

7. **Ajustes y robustez**  
   - Manejo de errores, mensajes ambiguos, destinatario no encontrado.  
   - Logs y (opcional) panel para ver últimos mensajes WhatsApp procesados.

---

## Consideraciones

- **Privacidad y consentimiento:** Solo enviar comprobantes a miembros de la familia que tengan teléfono registrado y, si aplica, avisar que DOMUS puede enviar notificaciones por WhatsApp.
- **Sandbox Twilio:** Al inicio solo números autorizados; para producción, número WhatsApp Business aprobado.
- **Costo:** Twilio cobra por mensaje; tener en cuenta volumen (pruebas vs producción).
- **Parser:** Empezar con formatos simples ("500 cine Sofía", "300 super") e ir ampliando con más ejemplos.

---

## Resumen

El plan (recibir → procesar → registrar → enviar comprobante) es coherente y mejora mucho la experiencia: quien paga registra en un solo paso y quien recibe obtiene el comprobante sin pasos extra. Tiene sentido implementarlo por fases en domus-beta-dbe empezando por Twilio, webhook de texto, parser, creación de transacción y envío de comprobante por WhatsApp al destinatario; después añadir fotos de recibos con OCR.
