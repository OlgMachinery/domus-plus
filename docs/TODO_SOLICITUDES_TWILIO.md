# TODO: Solicitudes de efectivo y Twilio

Lista única de todo lo que implementaremos, por fases. Marcar con `[x]` al completar.

---

## Fase 1 — MVP en app (sin WhatsApp)

- [ ] **1.1** Modelo y DB: tabla `MoneyRequest` en Prisma (campos: id, familyId, createdByUserId, requestedAt, forEntityId, forName, date, reason, amount, currency, status, transactionId, registrationCode, outboundMessageSid, approvedAt, approvedByUserId, rejectedAt, rejectedByUserId, deliveredAt, createdAt, updatedAt). Migración o `db push`.
- [ ] **1.2** Al crear solicitud, asignar `registrationCode` único por familia (ej. formato S-XXXX, reutilizar lógica tipo recibos).
- [ ] **1.3** API `POST /api/money-requests`: crear solicitud (familia activa, usuario autenticado). Validar motivo, monto, opcional partida/fecha.
- [ ] **1.4** API `GET /api/money-requests`: listar solicitudes de la familia con filtros (estado, desde/hasta fechas). Orden más recientes primero.
- [ ] **1.5** API `GET /api/money-requests/[id]`: detalle de una solicitud (solo familia).
- [ ] **1.6** API `PATCH /api/money-requests/[id]`: aprobar o rechazar (solo admin). Actualizar status, approvedAt/approvedByUserId o rejectedAt/rejectedByUserId.
- [ ] **1.7** API `POST /api/money-requests/[id]/deliver`: admin sube screenshot (y opcional monto enviado). Crear Transaction (egreso) con partida/categoría de la solicitud, crear Receipt con la imagen, vincular solicitud → transacción, marcar solicitud DELIVERED.
- [ ] **1.8** UI: **Botón rápido "Solicitud de efectivo"** visible (barra superior, Dashboard o Transacciones). Un clic → modal/panel con: motivo, monto, partida por defecto "mi partida", fecha por defecto hoy. Botón Enviar → POST → mostrar "Solicitud enviada" + timestamp.
- [ ] **1.9** UI: Menú "Solicitudes" y pantalla con listado (tabla o tarjetas), recordatorio 3 h / luz verde / 24 h. Filtros estado y fechas. Botón rápido también disponible aquí.
- [ ] **1.10** UI: Detalle de solicitud (al hacer clic). Si admin: botones **Aprobar (luz verde)** / **Rechazar**. Si aprobada: **Registrar entrega** (subir imagen + opcional monto enviado).
- [ ] **1.11** Feedback: tras crear solicitud, mensaje claro "Solicitud enviada" + timestamp (en modal o toast).

---

## Fase 2 — WhatsApp (Twilio)

- [ ] **2.1** Al crear una solicitud (desde app), enviar mensaje WhatsApp al admin de la familia (resumen: nombre, fecha, motivo, monto + código S-XXX). Guardar en la solicitud el **Message SID** devuelto por Twilio (`outboundMessageSid`).
- [ ] **2.2** Webhook: si llega **mensaje de texto** con formato de solicitud (📝 Nombre, 📆 Fecha, 🎯 Motivo, 💰 Cantidad), parsear, identificar usuario por teléfono, crear `MoneyRequest`, responder al usuario "Solicitud enviada" + timestamp. Notificar al admin por WhatsApp (mensaje con código) y guardar SID.
- [ ] **2.3** Webhook: si llega **imagen** con `context.reply_to_message_id`, buscar solicitud cuyo `outboundMessageSid` = ese id. Crear Transaction (monto: pie de foto o monto solicitado), Receipt con la imagen, vincular solicitud → transacción, marcar solicitud DELIVERED. Responder opcional "✓ Registrado: egreso vinculado a S-XXX".
- [ ] **2.4** Fallback: si llega imagen **sin** reply, permitir vincular por código en pie de foto (S-XXX) o por última solicitud aprobada pendiente del admin.
- [ ] **2.5** Pruebas E2E: crear solicitud en app → admin recibe por WA → admin hace transferencia → admin envía foto como reply → verificar en app egreso creado y solicitud Entregado.

---

## Fase 3 — UX y opcionales

- [ ] **3.1** Aviso suave al crear solicitud si la fecha de salida es en menos de 3 h (no bloquear): "La administración pide solicitar al menos 3 h antes."
- [ ] **3.2** Filtros y orden en listado: por persona (partida), por rango de fechas, por estado. Orden configurable (más recientes primero por defecto).
- [ ] **3.3** (Opcional) Crear solicitud por WhatsApp: si el usuario envía mensaje al número DOMUS con formato 📝📆🎯💰, ya cubierto en 2.2; si falta, asegurar parseo robusto y respuesta clara.

---

## Fase 4 — Split (extensión, opcional)

- [ ] **4.1** Modelo: líneas de split por transacción (tabla `TransferSplitLine` o campo JSON): concepto, monto, estado comprobante, opcional receiptId. Transacción puede tener varias líneas que sumen el total.
- [ ] **4.2** Al "Registrar entrega", admin puede indicar **split** (ej. 2000 = 800 gasolina + 200 farmacia crema Isabella + 1000 otro). Crear transacción con líneas; estado movimiento "por aprobar".
- [ ] **4.3** Webhook: si llega **mensaje de texto** como **reply** del receptor (usuario que recibió el dinero) con corrección tipo "gasolina 600" o "gasolina fueron 600", actualizar la línea correspondiente del split. Responder "✓ Actualizado: gasolina 600. Pendiente comprobante por concepto."
- [ ] **4.4** Webhook: si llega **imagen** como reply del admin al mensaje del movimiento/split, asociar a una línea del split (por pie de foto "gasolina", "farmacia", o por orden). Vincular Receipt a esa línea. Cuando todas las líneas tengan comprobante, marcar movimiento aprobado.
- [ ] **4.5** UI: Ver movimientos "por aprobar" (split pendiente de tickets). Detalle de transacción con líneas de split y estado de comprobante por línea.

---

## Resumen por fase

| Fase | Ítems | Alcance |
|------|-------|--------|
| Fase 1 | 11 | MVP en app: modelo, APIs, botón rápido, pantalla Solicitudes, Registrar entrega |
| Fase 2 | 5 | WhatsApp: notificación al admin, webhook solicitud, webhook comprobante por reply, fallback, pruebas |
| Fase 3 | 2–3 | Recordatorio 3 h, filtros, opcional parseo WA |
| Fase 4 | 5 | Split: líneas, corrección receptor, tickets por concepto, UI por aprobar |

**Total sin Fase 4:** 18–19 ítems. **Con Fase 4:** 24 ítems.

---

*Referencia: `PROPUESTA_SOLICITUD_DINERO_DOMUS.md`, `PLAN_SOLICITUDES_TWILIO_ANALISIS.md`.*
