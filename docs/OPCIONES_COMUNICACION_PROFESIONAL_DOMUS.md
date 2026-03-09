# Opciones para hacer más profesional la comunicación de DOMUS

Cuando DOMUS envía un recibo registrado, una solicitud de efectivo o un recordatorio, hoy todo es **mensaje de texto** en WhatsApp. Estas son opciones que existen para dar una imagen más profesional.

---

## 1. Mensaje de texto mejor estructurado (ya aplicable)

**Qué es:** Mismo canal (WhatsApp texto), pero con formato más claro: secciones, etiquetas consistentes, menos “pared de texto”.

**Ejemplo actual:**  
`Recibo registrado: $10864 – CFE. Fecha/hora: 06/03/2026... Clave de registro: E-FMOM. Clasificación: Renta / Hipoteca. Asignado a: Casa. Pendiente de...`

**Ejemplo más profesional:**
```
✓ Recibo registrado

Concepto: CFE
Monto: $10,864.00 MXN
Fecha: 6 mar 2026, 21:26
Clave: E-FMOM

Clasificación: Renta / Hipoteca → Casa

Pendiente: indica "para [nombre]" o reasigna con:
E-FMOM cumpleaños Sofía
```

**Ventajas:** Cero infraestructura nueva, solo cambiar el texto que generamos.  
**Implementación:** Ajustar las cadenas en el webhook y en `domus-agent` (donde se arma el mensaje de confirmación).

---

## 2. Enviar un PDF “Comprobante DOMUS” por WhatsApp

**Qué es:** Generar un PDF de una página con: logo/nombre DOMUS, familia, concepto, monto, fecha, clave (y opcional QR o link a la app) y enviarlo por WhatsApp como **documento**, no solo como texto.

**Flujo:** Al registrar el recibo (o al “confirmar” en app), generar el PDF (por ejemplo con `pdf-lib`, ya en el proyecto) → subir a Spaces → obtener URL pública (o firmada con caducidad) → enviar mensaje WhatsApp con **MediaUrl** apuntando a ese PDF (Twilio permite enviar PDF hasta 16 MB).

**Ventajas:** El usuario recibe un archivo que puede guardar, reenviar o imprimir; se ve como comprobante “de verdad”.  
**Requisitos:**  
- Generación de PDF en backend.  
- URL pública (o firmada que Twilio pueda descargar).  
- En Twilio, en la misma llamada se puede enviar **Body** (texto corto) + **MediaUrl** (PDF), para que no pierda el texto de resumen.

**Implementación técnica (resumen):**  
- Nueva función en `lib/whatsapp.ts`: `sendWhatsAppDocument(toPhone, mediaUrl, optionalCaption)`.  
- Módulo o función que, dado transaction/receipt, genere un PDF “Comprobante DOMUS” y lo suba a Spaces; luego llame a `sendWhatsAppDocument` con esa URL (y opcionalmente un Body corto).

---

## 3. Enviar una imagen “tarjeta” del recibo

**Qué es:** En lugar de (o además de) texto, generar una **imagen** (PNG/JPEG) tipo tarjeta: fondo, bordes, texto formateado (concepto, monto, fecha, código). Esa imagen se sube a Spaces y se envía por WhatsApp como imagen.

**Ventajas:** Muy visible en el chat, se ve “diseñado” sin pasar por aprobación de plantillas de Meta.  
**Requisitos:** Generar imagen en servidor (por ejemplo con `sharp`, `canvas` o similar).  
**Implementación:** Similar al PDF: función que genera la imagen desde los datos del recibo → subir a Spaces → enviar con `MediaUrl` (Twilio acepta imagen igual que documento).

---

## 4. Plantillas de mensaje de WhatsApp (Message Templates)

**Qué es:** En la API de WhatsApp Business (Twilio usa esta API), las **plantillas** son mensajes preaprobados por Meta con placeholders (ej. `{{1}}`, `{{2}}`). Ejemplo: “Tu recibo fue registrado. Concepto: {{1}}. Monto: {{2}}. Código: {{3}}.”

**Ventajas:** Aspecto muy oficial, buena entregabilidad, posibilidad de botones (p. ej. “Ver en app”).  
**Desventajas:** Hay que crear y aprobar las plantillas en Meta Business Manager; los textos son fijos (solo cambian las variables).  
**Requisitos:** Cuenta WhatsApp Business y aprobación de cada plantilla.  
**Implementación:** En Twilio, usar el endpoint de mensajes con `ContentSid` (o el flujo de Content API / Templates) en lugar de `Body` libre; rellenar las variables con los datos del recibo.

---

## 5. Email con comprobante (HTML + PDF adjunto)

**Qué es:** Si tenemos el **email** del usuario (en el perfil de DOMUS), además (o en lugar) de WhatsApp, enviar un correo con:  
- Asunto claro: “Comprobante DOMUS – E-FMOM – CFE”.  
- Cuerpo en HTML con la misma información que el comprobante (marca DOMUS, concepto, monto, fecha, clave).  
- Adjunto: el mismo PDF “Comprobante DOMUS”.

**Ventajas:** Muy profesional, el usuario tiene copia en su bandeja, se puede archivar o reenviar a contador.  
**Requisitos:** Servicio de envío de email (Resend, SendGrid, SES, etc.) y que el usuario tenga email en DOMUS.  
**Implementación:** Módulo de envío de email; al registrar/confirmar recibo, generar PDF (igual que en opción 2) y enviar email con adjunto + enlace a la app si se desea.

---

## Resumen rápido

| Opción                         | Esfuerzo | Impacto visual      | Requisitos extra                    |
|--------------------------------|----------|---------------------|-------------------------------------|
| 1. Texto mejor formateado      | Bajo     | Medio               | Ninguno                             |
| 2. PDF por WhatsApp            | Medio    | Alto                | Generar PDF, URL pública             |
| 3. Imagen “tarjeta” por WhatsApp | Medio  | Alto                | Generar imagen en servidor           |
| 4. Plantillas WhatsApp         | Medio–Alto | Muy alto (oficial) | Cuenta Business, aprobación Meta     |
| 5. Email + PDF adjunto         | Medio    | Muy alto            | Email del usuario, servicio de email |

Recomendación práctica: empezar por **1** (formato de texto) y por **2** (PDF por WhatsApp) si quieres que el “recibo” sea un archivo descargable y guardable sin tocar Meta ni email.

Referencias: Twilio [Send media](https://www.twilio.com/docs/whatsapp/tutorial/send-and-receive-media-messages-twilio-api-whatsapp), [Message templates](https://www.twilio.com/docs/whatsapp/api#message-templates). Proyecto: `domus-beta-dbe/src/lib/whatsapp.ts`, webhook en `src/app/api/whatsapp/webhook/route.ts`.
