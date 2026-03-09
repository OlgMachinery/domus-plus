# Propuesta: Solicitar dinero en DOMUS

## Contexto

Hoy la familia usa un **grupo de WhatsApp** para solicitar dinero con un formato fijo:

- **📝 Nombre:** (a quién aplica: Emb, Isabella, smb…)
- **📆 Día y hora de salida:** (fecha del gasto/salida)
- **🎯 Motivo específico:** (escuela, gasolina, salida con novia, láser, etc.)
- **💰 Cantidad solicitada:** (monto en pesos)

**Reglas que ya usa la administración en el grupo:**

- Las solicitudes se hacen **mínimo 3 horas antes** de salir. No pedir 1 hora antes ni al momento de salir (para planeación y confirmar si hay dinero disponible).
- **Esperar la luz verde** para tener autorización del dinero (ej. respuesta "Adelante").
- Buena práctica: **anticiparse 24 h** a una petición de efectivo.

Este documento propone llevar ese flujo **dentro de DOMUS** para centralizar, vincular al presupuesto y dar historial, respetando estas reglas.

---

## Permisos actuales (resumen)

- **Usuario (no admin):** Ve reportes y presupuesto en **solo lectura**; puede subir comprobantes y asignar gastos (propios o a otro). No puede modificar partidas ni montos.
- **Admin:** Todo lo anterior + crear/editar partidas, categorías, montos, usuarios, familia.

**Valoración:** Que el usuario vea todo y no modifique presupuesto está bien: da transparencia y evita cambios accidentales. La adición que más beneficia al usuario es **poder solicitar dinero desde DOMUS** (igual que en el grupo, pero con historial y opción de aprobación/registro de gasto).

---

## Objetivos de "Solicitar dinero" en DOMUS

1. **Un solo lugar:** Solicitudes visibles en DOMUS, vinculables a partidas y reportes.
2. **Mismo formato:** Nombre (partida/persona), Fecha, Motivo, Monto (y opcional categoría).
3. **Historial y filtros:** Por persona, fecha, estado (pendiente / aprobado / entregado).
4. **Aprobación en DOMUS o por WhatsApp:** El admin puede aprobar en la app o recibir la solicitud por WhatsApp (Twilio); al entregar sube screenshot en la app o **envía el comprobante por WhatsApp** y DOMUS queda enterado y registrado.
5. **Flujo por WhatsApp (Twilio):** El admin recibe la solicitud por WhatsApp, hace la transferencia y envía el comprobante por WhatsApp; DOMUS registra solicitud y egreso (ver más abajo).

---

## Flujo propuesto

### Resumen del flujo (solicitud → aprobación → egreso)

1. **Solicitud:** Cualquier miembro crea la solicitud en DOMUS (nombre, fecha, motivo, monto). La solicitud **llega al admin en DOMUS**.
2. **Aprobación en DOMUS:** El admin ve la solicitud en la app, da luz verde (Aprobar) o Rechaza. **Todo en DOMUS**, no por WhatsApp.
3. **Entrega y comprobante:** El admin realiza la transferencia y **retorna en DOMUS con un screenshot de la transferencia** (captura del comprobante).
4. **Registros generados:**
   - **Registro de solicitud:** La solicitud queda actualizada (estado Entregado, vinculada al egreso).
   - **Registro de egreso:** Se crea una **transacción** (gasto) en DOMUS con el monto, partida/categoría y el **comprobante** (screenshot de la transferencia) adjunto como evidencia.

Así queda trazabilidad: solicitud → aprobación → egreso con comprobante, todo en la app.

### Quién hace qué

| Acción | Cualquier miembro | Admin |
|--------|-------------------|--------|
| Crear solicitud (nombre, fecha, motivo, monto) | ✅ | ✅ |
| Ver listado de solicitudes de la familia | ✅ | ✅ |
| Aprobar / Rechazar solicitud (en DOMUS) | — | ✅ |
| Subir screenshot de la transferencia y registrar egreso | — | ✅ |
| Editar / cancelar propia solicitud (mientras esté pendiente) | ✅ | ✅ |

### Reglas de anticipación (reflejar en DOMUS)

- Mostrar en la pantalla Solicitudes un recordatorio: *Solicita mínimo 3 h antes de salir. Espera la luz verde (aprobación) antes de disponer del dinero. Ideal: anticiparse 24 h.*
- Opcional: al crear una solicitud con fecha/hora de salida en menos de 3 h, aviso suave (no bloquear): *La administración pide solicitar al menos 3 h antes.*

### Campos de una solicitud

- **Nombre (partida/persona):** Beneficiario del gasto (Emb, Isabella, smb, Gmb, mamá, etc.). En DOMUS: **entityId** (partida) o texto corto.
- **Fecha (y hora opcional):** Día y hora de salida/gasto. En el grupo a veces "Día y hora de salida" o "Día y hora de pago"; en DOMUS un campo "Fecha (y hora)" basta.
- **Motivo:** Texto libre (escuela, gasolina, salida con novia, HEB, Oxxo). Opcional: categoría del presupuesto.
- **Monto (solicitado):** Cantidad que pide el usuario. En el egreso se registra el **monto realmente enviado** por el admin (puede ser menos o más); la solicitud conserva el monto solicitado para referencia.
- **Creado por:** Usuario que envía la solicitud (puede ser para sí o para otro; ej. Verito pide para "emb").
- **Estado:** Pendiente → Aprobado (luz verde) o Rechazado → Entregado (con transacción vinculada).

### Botón rápido "Solicitud de efectivo"

En DOMUS la forma de pedir efectivo debe ser **sencilla**: un **botón rápido** siempre visible (ej. en la barra superior, en el Dashboard o en Transacciones) que abra un flujo corto:

- **Un clic** → se abre un modal o panel reducido (no una pantalla completa).
- **Campos mínimos:** Motivo (ej. "gasolina", "salida"), Monto, y opcional Partida (por defecto "mi partida" si está definida). Fecha puede ir por defecto "hoy" o en un solo campo.
- **Un botón "Enviar"** → se crea la solicitud y se muestra "Solicitud enviada" + timestamp. Listo.

Objetivo: que cualquier miembro pueda solicitar efectivo en **pocos segundos**, sin pasos extra.

### Pantalla "Solicitudes" (listado y detalle)

- **Recordatorio:** Texto visible con las reglas: solicitar mínimo 3 h antes, esperar luz verde, ideal 24 h de anticipación.
- **Listado:** Tabla o tarjetas con filtros (persona, fechas, estado). Orden: más recientes primero. Estados: Pendiente, Aprobado (luz verde), Rechazado, Entregado. Desde aquí también se puede usar el **botón rápido** para crear otra.
- **Crear (alternativa):** Si se prefiere, además del botón rápido puede haber "Nueva solicitud" en esta pantalla con el mismo formulario corto.
- **Detalle (admin):** Ver solicitud; botones **Aprobar (luz verde)** / Rechazar. Para solicitudes aprobadas: **"Registrar entrega"** → subir **screenshot de la transferencia** → se crea el **egreso** (transacción) con ese comprobante y la solicitud pasa a Entregado.

### Flujo "Registrar entrega" (admin)

1. Admin abrió la solicitud y ya dio "Aprobar" (luz verde).
2. Admin hace la transferencia en su banco.
3. En DOMUS, en esa solicitud, pulsa **"Registrar entrega"** (o "Subir comprobante de transferencia").
4. Sube una o más fotos (screenshot del comprobante de la transferencia).
5. El sistema: (1) crea la **transacción** (egreso) con monto, partida/categoría de la solicitud y fecha; (2) adjunta el comprobante a esa transacción (igual que un recibo); (3) actualiza la solicitud a **Entregado** y la vincula a esa transacción.

**Resultado:** registro de solicitud (actualizado a Entregado) + registro de egreso (transacción con el **monto realmente enviado** y comprobante). Si el admin envió menos o más que lo solicitado, el egreso refleja lo que realmente se transfirió.

### Integración con presupuesto

- Al crear la solicitud se elige **partida** (entity) y opcional **categoría**; al "Registrar entrega" la transacción (egreso) se crea con esa partida y categoría.
- Si no se eligió partida, en "Registrar entrega" el admin asigna partida/categoría antes de guardar.

---

## Flujo por WhatsApp (Twilio)

Objetivo: el **usuario genera la solicitud** → DOMUS da feedback → el **admin recibe la solicitud con código de registro** → hace la transferencia y **envía el comprobante como reply** al mensaje de solicitud → DOMUS registra todo.

### Pasos

1. **Usuario genera la solicitud**
   - En DOMUS (pantalla Solicitudes) o por WhatsApp (mensaje con formato 📝📆🎯💰 al número de DOMUS).

2. **DOMUS responde con feedback al usuario**
   - **Solicitud enviada** + **timestamp** (en la app y/o por WhatsApp si envió por ahí). Ej.: *"Solicitud enviada. 5 mar 2026, 14:32"*

3. **Admin recibe la solicitud por WhatsApp (con código de registro)**
   - DOMUS envía por Twilio al admin (o al grupo) un mensaje con: 📝 Nombre, 📆 Fecha, 🎯 Motivo, 💰 Cantidad y el **código de registro** (ej. `S-ABC12`).
   - Al enviar ese mensaje, DOMUS guarda el **Message SID** que devuelve Twilio y lo asocia a esa solicitud (para poder vincular después el reply).

4. **Admin hace la transferencia** (en su banco).

5. **Admin envía el comprobante respondiendo al mensaje de solicitud (reply)**
   - En WhatsApp, el admin hace **reply** al mensaje donde recibió la solicitud y adjunta la **foto** (screenshot del comprobante).
   - No hace falta escribir el código: el **reply** indica a qué mensaje (y por tanto a qué solicitud) corresponde el comprobante.

6. **DOMUS queda enterado y registrado**
   - El webhook de Twilio recibe la imagen; el mensaje trae **contexto de reply** (`reply_to_message_id` o similar = el SID del mensaje al que se respondió).
   - DOMUS busca qué solicitud se notificó con ese Message SID → obtiene la solicitud correcta.
   - **Monto del egreso:** Se registra **lo que el admin envió** (el monto real de la transferencia). Si en el mensaje o pie de foto el admin indica un monto (ej. "500" o "envié 500"), se usa ese; si no, se puede intentar extraer del comprobante (OCR) o usar por defecto el monto solicitado. **Si fue menos o más que lo solicitado, igual se registra el monto real enviado.**
   - Crea la **transacción** (egreso) con ese monto, adjunta la imagen como **comprobante** (Receipt), actualiza la solicitud a **Entregado** y la vincula a la transacción.
   - Opcional: responde por WhatsApp *"✓ Registrado: egreso [monto] vinculado a solicitud S-ABC12."*

### Resumen flujo WhatsApp

| Paso | Quién | Dónde | Qué pasa |
|------|--------|--------|----------|
| 1 | Usuario | DOMUS o WhatsApp | Genera la solicitud |
| 2 | DOMUS | App / WhatsApp | Feedback al usuario: "Solicitud enviada" + timestamp |
| 3 | DOMUS | Twilio → Admin | Envía al admin mensaje con solicitud + código (S-XXX); guarda Message SID |
| 4 | Admin | Banco | Hace la transferencia |
| 5 | Admin | WhatsApp | Envía comprobante como **reply** al mensaje de solicitud |
| 6 | DOMUS | Webhook Twilio | Recibe imagen con reply context → vincula por Message SID → crea egreso + comprobante, marca solicitud Entregado |

### Ventaja del reply

- El admin **no escribe** el código: solo responde al mismo mensaje donde vio la solicitud. Menos fricción y menos errores.
- Twilio envía en el webhook el **id del mensaje al que se respondió**; si guardamos el SID del mensaje que enviamos al notificar la solicitud, asociamos comprobante ↔ solicitud de forma automática.

### Implementación técnica (referencia)

- **Al notificar la solicitud al admin:** Llamar a Twilio para enviar el mensaje; guardar el **Message SID** devuelto en la solicitud (campo ej. `outboundMessageSid` o en tabla auxiliar `message_sid` ↔ `moneyRequestId`).
- **Webhook:** Si llega una **imagen** y el mensaje tiene `context.reply_to_message_id`, buscar la solicitud cuyo mensaje de notificación tenga ese SID. Crear Transaction con el **monto enviado** (si el admin lo indica en el texto/pie de foto, usarlo; si no, OCR o monto solicitado por defecto). Crear Receipt con la imagen; actualizar MoneyRequest a DELIVERED. **Regla:** si fue menos o más que lo solicitado, se registra lo que el admin envió.
- **Fallback:** Si no hay reply context, vincular por código `S-XXX` en el pie de foto o por última solicitud aprobada pendiente.

---

## Transferencia con split y comprobantes por concepto

Caso: el admin envía **un solo monto** (ej. 2000) pero lo reparte en varios conceptos (split). El **receptor** puede corregir por reply; el **movimiento del admin queda por aprobar** hasta que envíe los tickets que justifiquen cada parte.

### Flujo

1. **Admin envía transferencia e indica split (opcional)**  
   Ej.: envía 2000 y en el mensaje o al registrar dice: *800 gasolina, 1200 otro* (o *800 gasolina, 200 farmacia crema Isabella, 1000 otro*). Se registra un **movimiento** (egreso total 2000) con un **desglose** (split): varias líneas concepto + monto.

2. **Receptor (usuario) responde con reply corrigiendo**  
   Ej.: hace **reply** al mensaje donde recibió la notificación y escribe *"gasolina fueron 600"*.  
   - El sistema interpreta la corrección (gasolina 800 → 600) y actualiza el split.  
   - DOMUS **responde al cambio**: ej. *"✓ Actualizado: gasolina 600. Pendiente comprobante por concepto."*

3. **Movimiento del admin queda "por aprobar"**  
   El egreso (2000) sigue en estado **pendiente de comprobante** (o "por aprobar") hasta que el admin envíe los **tickets** que justifiquen cada parte del split:
   - Ticket **gasolina 600** (reply con la foto del ticket de gasolina).
   - Ticket **farmacia 200 crema Isabella** (reply con la foto del ticket de farmacia).
   - Cuando cada línea del split tenga su comprobante (o los tickets enviados cuadren con el desglose), el movimiento pasa a **aprobado** / cerrado.

4. **Admin envía tickets por reply**  
   El admin hace **reply** al mensaje del movimiento (o a la notificación del split) y envía:
   - Una foto: ticket gasolina 600 → el sistema asocia a la línea "gasolina 600".
   - Otra foto: ticket farmacia 200 → el sistema asocia a "farmacia 200 crema Isabella" (o pide en el pie de foto "farmacia crema Isabella" para asignar).  
   Cuando todas las líneas tengan ticket, el movimiento deja de estar "por aprobar".

### Resumen

| Quién | Acción | Qué pasa |
|--------|--------|----------|
| Admin | Envía 2000 + split (800 gasolina, 200 farmacia, …) | Se crea movimiento con desglose; estado "por aprobar" |
| Receptor | Reply: "gasolina fueron 600" | Sistema actualiza split (800→600), responde confirmando el cambio |
| Admin | Reply con ticket gasolina 600 | Se vincula comprobante a la línea gasolina; sigue pendiente el resto |
| Admin | Reply con ticket farmacia 200 crema Isabella | Se vincula a la línea farmacia; si ya no hay líneas sin ticket, movimiento aprobado |

### Implementación (referencia)

- **Modelo:** Un egreso (transacción) puede tener **líneas de split** (concepto, monto, opcional categoría/partida, y estado: sin comprobante / con comprobante). O una tabla `TransferSplitLine` vinculada a la transacción.
- **Webhook:** Mensaje de texto con reply al mensaje del movimiento → si el remitente es el **receptor** (usuario que recibió el dinero), parsear correcciones tipo "gasolina 600" o "gasolina fueron 600" y actualizar el split; responder confirmando. Imagen con reply al mensaje del movimiento → si el remitente es **admin**, interpretar como ticket para una línea del split (por pie de foto "gasolina", "farmacia crema isabella", o por orden); vincular Receipt a esa línea; cuando todas las líneas tengan comprobante, marcar movimiento aprobado.

---

## Modelo de datos (borrador)

- **MoneyRequest** (o `SolicitudDinero`):  
  `id`, `familyId`, `createdByUserId`, `requestedAt`, `forEntityId` (opcional), `forName` (texto si no hay partida), `date` (fecha del gasto), `reason` (motivo), `amount`, `currency`, `status` (PENDING | APPROVED | REJECTED | DELIVERED), `transactionId` (opcional, cuando se registra la entrega con comprobante), `registrationCode` (clave corta tipo `S-ABC12` para mostrar al admin), `outboundMessageSid` (opcional: SID del mensaje Twilio enviado al admin con esta solicitud; sirve para vincular el **reply** con el comprobante), `approvedAt`, `approvedByUserId`, `rejectedAt`, `rejectedByUserId`, `deliveredAt`, `createdAt`, `updatedAt`.

- Relaciones: Family, User (createdBy, approvedBy), BudgetEntity (forEntityId), **Transaction** (transactionId = egreso; el **amount** de la transacción es el monto **realmente enviado** en la transferencia, aunque sea distinto al monto solicitado; el comprobante se guarda como Receipt asociado a esa Transaction).

- **Split (opcional):** Para transferencias con desglose, se pueden tener **líneas de split** por transacción: concepto (ej. gasolina, farmacia crema Isabella), monto, y estado (pendiente comprobante / con comprobante). Cada línea puede tener un Receipt asociado cuando el admin envía el ticket correspondiente. El movimiento total queda "por aprobar" hasta que todas las líneas tengan comprobante.

---

## Fases sugeridas

1. **Fase 1 (MVP):** Modelo + API CRUD + pantalla "Solicitudes" (crear, listar, filtrar). Aprobación/Rechazo por admin. "Registrar entrega" = subir screenshot + crear transacción (egreso) + actualizar solicitud a Entregado.
2. **Fase 2:** Flujo por **WhatsApp (Twilio)**: admin recibe solicitud por WhatsApp (con clave S-XXX), hace transferencia, envía comprobante por WhatsApp; webhook registra egreso y actualiza solicitud a Entregado.
3. **Fase 3:** Ajustes de UX, recordatorios (3 h / 24 h), filtros. Opcional: crear solicitud por mensaje al número DOMUS (parseo 📝📆🎯💰).
4. **Fase 4 (extensión):** Transferencia con **split** (ej. 2000 = 800 gasolina + 200 farmacia + …). Reply del **receptor** para corregir montos ("gasolina fueron 600") → sistema responde al cambio. Movimiento del admin **por aprobar** hasta que envíe los tickets por concepto (ticket gasolina 600, ticket farmacia 200 crema Isabella, etc.).

---

## Resumen

- **Solicitud:** Se crea en DOMUS (o por WhatsApp); el admin puede verla en la app y **recibirla también por WhatsApp** (Twilio).
- **Aprobación:** En DOMUS o por WhatsApp (luz verde).
- **Entrega:** El admin hace la transferencia y puede:
  - **En DOMUS:** Subir screenshot → se genera registro de solicitud (Entregado) + egreso (transacción con comprobante).
  - **Por WhatsApp:** Hacer **reply** al mensaje de solicitud con la foto del comprobante → el webhook recibe la imagen con el contexto de reply, vincula por Message SID a la solicitud, registra el egreso y actualiza la solicitud a Entregado. **DOMUS queda enterado y todo registrado.**

**Extensión (split):** Si el admin envía un monto con split (ej. 2000 = 800 gasolina + 200 farmacia), el receptor puede reply para corregir ("gasolina fueron 600"); el sistema confirma el cambio. El movimiento del admin queda **por aprobar** hasta que envíe los tickets que justifiquen cada parte (ticket gasolina 600, ticket farmacia 200 crema Isabella, etc.).

Cuando quieras implementar, se puede seguir este doc como spec; el webhook actual (`/api/whatsapp/webhook`) se extiende para solicitudes, comprobantes y (en Fase 4) split + correcciones del receptor + comprobantes por concepto.
