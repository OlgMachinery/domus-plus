# Plan: Solicitudes y Twilio — Conteo, análisis y sugerencias

Documento de referencia a partir del chat del día (contexto Twilio / solicitud de dinero). Incluye qué ya está hecho, cuántos cambios quedan por fase y análisis/sugerencias.

---

## 1. Resumen de lo tratado hoy (Twilio / solicitudes)

| Tema | Conclusión |
|------|------------|
| Qué ve cada usuario | Doc `QUE_VE_CADA_USUARIO.md`: usuarios ven todo (reportes, presupuesto) en solo lectura; pueden subir comprobantes (propios o asignar a otro) y foto de perfil de su partida si son responsables. |
| Comprobantes para otro (ej. medicina) | Implementado: cualquier miembro puede subir comprobante y asignar a "Otros usuarios"; API `from-receipt` acepta `assignToUserId` para cualquier miembro. |
| Foto de perfil partida | Implementado: API `entities/[id]/image` permite subir si eres admin o owner de la entidad; UI habilita botones para la partida de la que eres responsable. |
| Solicitud de dinero en DOMUS | Propuesta en `PROPUESTA_SOLICITUD_DINERO_DOMUS.md`: solicitud → aprobación → egreso con comprobante (app y/o WhatsApp). |
| Flujo por Twilio | Admin recibe solicitud por WhatsApp (con código); hace transferencia; envía comprobante como **reply** al mensaje; DOMUS registra egreso y actualiza solicitud. Feedback al usuario: "Solicitud enviada" + timestamp. |
| Monto enviado ≠ solicitado | Regla: registrar **lo que el admin envió** (menos o más); el egreso lleva el monto real. |
| Transferencia con split | Extensión: admin envía ej. 2000 con split (800 gasolina, 200 farmacia…); receptor puede reply "gasolina fueron 600" → sistema actualiza y responde; movimiento "por aprobar" hasta que admin envíe tickets por concepto (gasolina 600, farmacia 200 crema Isabella, etc.). |

---

## 2. Conteo de cambios

### Ya implementado (antes de “solicitudes”)

- API `from-receipt`: permitir `assignToUserId` a cualquier miembro (no solo admin).
- API `entities/[id]/image`: permitir subir/quitar foto si es admin o owner de la entidad.
- UI Presupuesto: botones Subir/Cambiar/Quitar foto habilitados cuando el usuario es owner de la partida.
- UI Transacciones: texto "Otros usuarios" actualizado (gastos que no son tuyos, ej. medicina).
- Docs: `QUE_VE_CADA_USUARIO.md`, `PROPUESTA_SOLICITUD_DINERO_DOMUS.md` (completa con WhatsApp, reply, monto enviado, split).

### Por implementar (Solicitudes + Twilio)

**Fase 1 — MVP en app (sin WhatsApp aún)**  
Aprox. **6–8 bloques** de trabajo:

1. **Modelo y DB:** Tabla `MoneyRequest` (o `SolicitudDinero`) en Prisma con todos los campos del doc (incl. `registrationCode`, `outboundMessageSid`); migración/push.
2. **API CRUD solicitudes:**  
   - `POST /api/money-requests` (crear; solo familia activa).  
   - `GET /api/money-requests` (listar con filtros: estado, fechas, familia).  
   - `GET /api/money-requests/[id]` (detalle).  
   - `PATCH /api/money-requests/[id]` (aprobar, rechazar; solo admin).
3. **API “Registrar entrega”:**  
   - `POST /api/money-requests/[id]/deliver` (admin sube screenshot, opcional monto enviado; crea Transaction + Receipt, vincula, marca solicitud DELIVERED).
4. **Generación de código:** Al crear solicitud, asignar `registrationCode` único (ej. formato `S-XXXX` como en recibos).
5. **UI: botón rápido "Solicitud de efectivo":** Botón siempre visible (barra, Dashboard o Transacciones) que abra un **modal o panel corto** con campos mínimos: motivo, monto, partida por defecto "mi partida", fecha por defecto hoy. Un botón "Enviar" → crear solicitud y mostrar "Solicitud enviada" + timestamp. Objetivo: **sencillo**, pocos segundos.
6. **UI pantalla Solicitudes:** Menú "Solicitudes" con listado (tabla o tarjetas), filtros (estado, fechas), recordatorio 3 h / luz verde / 24 h. Mismo botón rápido disponible aquí para crear otra.
7. **UI detalle solicitud (admin):** Botones Aprobar / Rechazar; para aprobadas, "Registrar entrega" (subir imagen + opcional monto enviado).
8. **Feedback en app:** Tras crear solicitud, mostrar "Solicitud enviada" + timestamp (y opcionalmente disparar notificación a admin en app si se desea después).

**Fase 2 — WhatsApp (Twilio)**  
Aprox. **5–6 bloques**:

9. **Envío al admin por Twilio:** Al crear una solicitud (desde app o desde webhook), enviar mensaje WhatsApp al admin (o grupo) con resumen + código; guardar en la solicitud el **Message SID** devuelto por Twilio.
10. **Webhook: crear solicitud desde WhatsApp:** Si llega mensaje de texto con formato 📝📆🎯💰, parsear y crear `MoneyRequest`; identificar usuario por teléfono; responder al usuario "Solicitud enviada" + timestamp; notificar al admin (mensaje con código) y guardar SID.
11. **Webhook: comprobante como reply:** Si llega **imagen** con `context.reply_to_message_id`, buscar solicitud cuyo `outboundMessageSid` coincida con ese id; crear Transaction (monto del pie de foto o solicitado), Receipt con la imagen, vincular solicitud → transacción, marcar solicitud DELIVERED; opcional respuesta "✓ Registrado…".
12. **Fallback sin reply:** Si llega imagen sin reply, permitir vincular por código en pie de foto (ej. "S-ABC12") o por última solicitud aprobada pendiente del admin.
13. **Pruebas:** Flujo completo: crear solicitud (app o WA) → admin recibe por WA → admin hace transferencia → admin reply con foto → verificar egreso y solicitud Entregado en app.

**Fase 3 — UX y opcionales**  
Aprox. **2–4 bloques**:

14. Recordatorio 3 h / 24 h (aviso suave si la fecha de salida es en &lt; 3 h).
15. Filtros y orden en listado (persona, fechas, estado).
16. Opcional: crear solicitud enviando mensaje al número DOMUS (si no se hizo en Fase 2).

**Fase 4 — Split (extensión)**  
Aprox. **6–8 bloques** (solo si se confirma prioridad):

17. Modelo: líneas de split por transacción (concepto, monto, estado comprobante) o tabla `TransferSplitLine`.
18. Admin puede indicar split al registrar entrega (ej. 2000 = 800 gasolina + 200 farmacia).
19. Webhook: mensaje de texto como **reply** del receptor con corrección ("gasolina 600") → actualizar split y responder confirmación.
20. Webhook: imagen como reply del admin → asociar a línea de split (por pie de foto o orden); cuando todas las líneas tengan comprobante, marcar movimiento aprobado.
21. UI: ver movimientos "por aprobar" (split pendiente de tickets) y detalle de líneas.

**Total aproximado:**  
- **Fase 1:** 6–8 ítems.  
- **Fase 2:** 5–6 ítems.  
- **Fase 3:** 2–4 ítems.  
- **Fase 4:** 6–8 ítems (opcional).  

Sin Fase 4: **13–18 cambios** concretos. Con Fase 4: **19–26**.

---

## 3. Análisis y sugerencias

### Fortalezas del diseño actual

- **Un solo flujo documentado:** App + WhatsApp conviven; el admin puede trabajar desde la app o solo por WhatsApp (reply con comprobante).
- **Reply para vincular:** No hace falta que el admin escriba códigos; Twilio da el id del mensaje al que se respondió y con el SID guardado la vinculación es automática.
- **Monto real:** Registrar lo enviado (menos o más) evita discrepancias entre reportes y realidad.
- **Split pensado para después:** Fase 4 bien acotada (líneas, corrección del receptor, tickets por concepto) sin bloquear el MVP.

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Twilio no devuelve `reply_to` en todos los entornos | Mantener fallback por código (S-XXX) en pie de foto y por "última solicitud aprobada pendiente". |
| Varias solicitudes aprobadas pendientes del mismo admin | Al notificar al admin, guardar siempre el SID del mensaje enviado; el reply desambigua. Si no hay reply, pedir código en pie de foto. |
| Parseo de solicitud por WhatsApp frágil | Definir regex/claves claras (📝 Nombre:, 📆, 🎯, 💰); aceptar variaciones (con/sin emoji, "Día y hora de pago"); responder con error amigable si falta campo. |
| Split (Fase 4) complejo | Implementar Fases 1–2–3 primero; validar uso real antes de invertir en split. |

### Sugerencias de orden

1. **Empezar por Fase 1** (modelo, API CRUD, pantalla Solicitudes, Registrar entrega en app). Sin Twilio ya se puede usar el flujo completo en la app.
2. **Luego Fase 2** (envío al admin por Twilio, webhook solicitud, webhook comprobante por reply). Verificar en Twilio que el webhook recibe `context.reply_to_message_id` (o el nombre equivalente) en respuestas a mensajes enviados por nuestra API.
3. **Fase 3** según prioridad (recordatorios y filtros).
4. **Fase 4** solo si la familia usa mucho el split; se puede dejar documentado y hacer después.

### Sugerencias técnicas

- **Código de solicitud:** Reutilizar la misma lógica de `registrationCode` que ya tienen para transacciones/recibos (formato corto, único por familia).
- **Webhook existente:** Extender `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`: rama para mensaje de texto (parsear solicitud o corrección de split), rama para imagen (comprobante de solicitud o ticket de línea de split); en ambos casos usar `reply_to` cuando exista.
- **Envío a admin:** Obtener teléfono(s) de los admins de la familia (o número de grupo si aplica) y usar la misma integración Twilio que ya tienen para enviar el mensaje de notificación; guardar el SID en `MoneyRequest.outboundMessageSid`.
- **Transacción desde solicitud:** Reutilizar `allocationId` (o entityId + categoryId) de la solicitud para crear la Transaction; si la solicitud no tiene partida, en "Registrar entrega" (app o flujo posterior) el admin debe elegir partida/categoría.

### Métricas útiles una vez en uso

- Solicitudes creadas por semana (app vs WhatsApp).
- Tiempo medio entre aprobación y envío de comprobante (reply).
- Cuántas veces el monto enviado ≠ solicitado (para afinar mensajes o recordatorios).

---

## 4. Siguiente paso concreto

Para **empezar con los cambios** de forma ordenada:

1. **Fase 1.1:** Añadir modelo `MoneyRequest` en Prisma y migración (o `db push` en dev).  
2. **Fase 1.2:** Implementar `POST /api/money-requests` y `GET /api/money-requests` (crear y listar).  
3. **Fase 1.3:** Añadir **botón rápido "Solicitud de efectivo"** (barra, Dashboard o Transacciones) que abra modal con formulario corto: motivo, monto, partida por defecto, fecha por defecto hoy → Enviar → POST. Y menú "Solicitudes" con listado (aunque sea vacío).
4. **Fase 1.4:** Al guardar, mostrar "Solicitud enviada" + timestamp (en el modal o como toast).
5. **Fase 1.5:** Implementar PATCH (aprobar/rechazar) y POST `money-requests/[id]/deliver` (subir screenshot, crear Transaction + Receipt, marcar Entregado).  
6. **Fase 1.6:** UI detalle de solicitud para admin (Aprobar, Rechazar, Registrar entrega con upload).

Con eso se cierra el MVP en app. Después se puede seguir con Fase 2 (Twilio) en el mismo repo y webhook.

---

*Documento generado a partir del contexto del chat (solicitudes, Twilio, reply, monto enviado, split). Actualizar este plan cuando se completen fases o se cambien prioridades.*
