# Tareas concretas: IA en el core de DOMUS

Backlog de tareas derivado de `docs/IA_EN_COLUMNA_VERTEBRAL_DOMUS.md`. Cada ítem tiene título, alcance, archivos a tocar y criterios de aceptación. Orden sugerido por impacto y esfuerzo.

---

## Fase A — Alto impacto, poco cambio

### A1. Unificar from-receipt (web) con IA para partida completa

**Objetivo:** En la web, al subir recibo y extraer, sugerir **allocationId** (entidad + categoría) con IA como en WhatsApp imagen, en lugar de solo `inferCategoryHint` + `scoreAllocation`.

**Alcance:**
- En `POST /api/transactions/from-receipt`: cuando no viene `allocationId` en el form, después de tener `extraction` (merchantName, rawText), llamar a `suggestCategoryForReceipt` para obtener categoría.
- Opcional: nueva función en `domus-agent.ts` que, dado comercio + texto + lista de **asignaciones** (entity+category), devuelva la allocationId más plausible (o reutilizar preferencias por comercio + scoring por entidad).
- Si ya existe preferencia por comercio (`FamilyCategoryPreference`), usarla; si no, usar IA. Elegir entidad: misma lógica que WhatsApp (asignar a usuario que sube, o sugerir “Casa” si no hay “para X”).

**Archivos:** `domus-beta-dbe/src/app/api/transactions/from-receipt/route.ts`, opcional `domus-beta-dbe/src/lib/agent/domus-agent.ts`.

**Criterios de aceptación:**
- [ ] Recibo subido desde web sin allocationId preseleccionada obtiene una sugerencia de partida (entidad + categoría) coherente con el comercio/texto.
- [ ] Se respeta preferencia aprendida por comercio cuando exista.
- [ ] No se rompe el flujo actual cuando el usuario sí envía allocationId.

---

### A2. Enriquecer contexto del agente (totales por categoría / resumen)

**Objetivo:** El agente WhatsApp (y futuro chat en app) pueda responder “¿cuánto en super?” o “resumen del mes” con datos reales, no solo últimos 5 gastos.

**Alcance:**
- En `buildAgentContext` (domus-agent.ts): añadir totales por categoría del mes en curso (o periodo configurable), y/o total gastado por entidad.
- Opcional: endpoint `GET /api/reports/summary?from=...&to=...` que devuelva { byCategory: [...], byEntity: [...], total } para inyectar en el prompt o en la app.
- Actualizar `formatContextForPrompt` para incluir ese bloque (resumido, sin saturar tokens).

**Archivos:** `domus-beta-dbe/src/lib/agent/domus-agent.ts`, opcional `domus-beta-dbe/src/app/api/reports/summary/route.ts` (nuevo).

**Criterios de aceptación:**
- [ ] El agente recibe en su contexto totales por categoría (al menos del mes actual).
- [ ] Respuestas a “¿cuánto gastamos en super?” (o categoría equivalente) son coherentes con los datos de la familia.
- [ ] Límite de tokens del prompt no se dispara (recortar a top N categorías si hace falta).

---

### A3. Detección de intención de solicitud de efectivo por IA (WhatsApp)

**Objetivo:** Que mensajes como “me prestas 500 super”, “dame 300 para farmacia”, “advance 200 gas” creen una solicitud de efectivo sin depender solo de los 3 regex actuales.

**Alcance:**
- Antes de decidir que el mensaje es “gasto” (parseTextMessage) o “agente”, llamar a un clasificador/intención: “¿es solicitud de efectivo?”.
- Si sí: extraer monto y motivo (con IA si hace falta) y seguir el flujo actual de creación de `MoneyRequest` (mismo endpoint lógico que `parseMoneyRequestIntent`).
- Implementación: puede ser una llamada ligera a LLM (system: “Clasifica si es solicitud de dinero; si sí, devuelve JSON { intent: 'money_request', amount: number, reason: string }”) o reglas ampliadas + fallback a IA para textos ambiguos.

**Archivos:** `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`, opcional `domus-beta-dbe/src/lib/agent/domus-agent.ts` (nueva función `parseMoneyRequestFromText` o similar).

**Criterios de aceptación:**
- [ ] Al menos 2 variantes nuevas de solicitud (ej. “me prestas X Y”, “dame X para Y”) crean correctamente una MoneyRequest.
- [ ] No se crean solicitudes con mensajes que son claramente gasto (ej. “500 cine”).
- [ ] El mensaje de confirmación al usuario y la notificación al admin siguen igual.

---

## Fase B — Alto impacto, cambio medio

### B1. Normalizar mensaje de gasto por texto con IA (WhatsApp)

**Objetivo:** Aceptar variantes como “gasté 500 en cine”, “500 pesos para Sofía cine”, “cine 500” y convertirlas al mismo formato que usa el flujo actual (amount, concept, recipientName).

**Alcance:**
- Si `parseTextMessage` no hace match, llamar a una función que con IA normalice el texto a `{ amount, concept, recipientName }` (y opcionalmente indicar “no es gasto”).
- Integrar en el webhook: si parsed = null y el mensaje parece corto (< ~100 caracteres), intentar normalización por IA; si devuelve gasto válido, seguir con el flujo de creación de transacción existente.

**Archivos:** `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`, `domus-beta-dbe/src/lib/agent/domus-agent.ts` (ej. `normalizeExpenseMessage(text): { amount, concept, recipientName } | null`).

**Criterios de aceptación:**
- [ ] Al menos “gasté 500 en cine” y “500 pesos cine” (o una variante acordada) registran el gasto correctamente.
- [ ] No se interpretan como gasto mensajes que son pregunta o solicitud.
- [ ] Se mantiene el comportamiento actual cuando el formato ya es “500 cine Sofía”.

---

### B2. Detección de duplicados al crear transacción

**Objetivo:** Al crear una transacción (manual o desde recibo), avisar si existe una reciente muy similar para evitar doble captura.

**Alcance:**
- Función `findPossibleDuplicate(familyId, { amount, date, descriptionOrMerchant })`: buscar en transacciones recientes (ej. últimos 7–30 días) con monto en rango (ej. ±1% o ±2 pesos), fecha misma o adyacente, y similitud de descripción (string normalizado o embedding).
- Llamar a esta función en `POST /api/transactions` y en `POST /api/transactions/from-receipt` (y opcionalmente en webhook cuando se crea transacción por texto/imagen). Si hay candidato, devolver en la respuesta un aviso: `{ duplicateWarning: { transactionId, date, description } }` sin dejar de crear; la UI puede mostrar “¿Es la misma que …? Ya se creó la nueva.”
- Alternativa más conservadora: solo en from-receipt, comparar por monto + fecha + merchantName; si hay match, devolver 200 con `duplicateWarning` y la transacción creada.

**Archivos:** `domus-beta-dbe/src/app/api/transactions/route.ts`, `domus-beta-dbe/src/app/api/transactions/from-receipt/route.ts`, opcional `domus-beta-dbe/src/lib/agent/` o `lib/dedup.ts` para la lógica.

**Criterios de aceptación:**
- [ ] Al crear una transacción con monto y fecha muy parecidos a una reciente de la misma familia, la API incluye un aviso de posible duplicado (o un flag).
- [ ] No se bloquea la creación; el usuario puede ignorar el aviso.
- [ ] Definir umbral (ej. misma fecha o ±1 día, monto igual o ±2%, descripción similar).

---

### B3. Resolver concepto → categoría con IA en webhook (sustituir/complementar CONCEPT_TO_CATEGORY)

**Objetivo:** Para gastos y solicitudes por WhatsApp, cuando el concepto no está en el diccionario estático, usar IA para mapear a una categoría existente de la familia o indicar “sugerir nueva”.

**Alcance:**
- Nueva función en domus-agent (ej. `resolveCategoryFromConcept(concept, categoryNames)`): dado un concepto corto y la lista de nombres de categoría de la familia, devolver nombre de categoría existente o `{ suggestNew: 'Nombre' }`.
- En webhook: donde hoy se usa `resolveCategoryHint(parsed.concept)`, si devuelve null (o para todos los casos), llamar a `resolveCategoryFromConcept` con las categorías de la familia; usar el resultado en `findAllocationWithDetails`.
- Mantener CONCEPT_TO_CATEGORY como primera capa (rápida, sin costo) y usar IA solo cuando no hay match o para conceptos largos.

**Archivos:** `domus-beta-dbe/src/lib/agent/domus-agent.ts`, `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`.

**Criterios de aceptación:**
- [ ] Conceptos como “gimnasio”, “netflix”, “gasolina” (si la familia tiene categorías que encajen) asignan a la partida correcta cuando el diccionario no tiene entrada.
- [ ] Si la IA sugiere categoría nueva, se puede integrar con el flujo de CategorySuggestion existente (opcional en esta tarea).
- [ ] No se añade latencia innecesaria cuando el concepto ya resuelve por diccionario.

---

## Fase C — Refinamiento

### C1. Reasignar por clave: entityHint + categoryHint por IA

**Objetivo:** Para mensajes “E-ABC12 cumpleaños mamá” o “E-ABC12 para mi esposa super”, obtener entityHint y categoryHint de forma fiable usando IA y la lista de entidades/miembros.

**Alcance:**
- Función `parseReassignHints(text, { entityNames, categoryNames })` que devuelva `{ categoryHint, entityHint }`; puede usar IA para desambiguar “mamá”/“esposa” cuando hay varios miembros.
- En webhook, donde se usa `parseConceptAndEntityForReassign(rest)`, llamar a esta función (o híbrido: regex primero, IA si la última palabra no matchea con ninguna entidad).

**Archivos:** `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`, `domus-beta-dbe/src/lib/agent/domus-agent.ts`.

**Criterios de aceptación:**
- [ ] “E-ABC12 cumpleaños mamá” asigna a la entidad correcta cuando “mamá” se puede resolver (ej. una sola persona con ese rol o nombre en la familia).
- [ ] No se rompe el flujo actual para “E-ABC12 cumpleaños Sofía”.

---

### C2. Solicitud de efectivo: extraer “para [nombre]” y setear forEntityId/forName

**Objetivo:** En mensajes como “necesito 500 para Sofía super”, crear la solicitud con forEntityId/forName cuando Sofía sea una entidad o miembro identificable.

**Alcance:**
- Al procesar money request intent, parsear el motivo en busca de “para [nombre]” (regex o IA). Resolver nombre a entidad de la familia (BudgetEntity vinculada a usuario o nombre de entidad).
- Pasar forEntityId y/o forName al crear `MoneyRequest` cuando venga en el mensaje.

**Archivos:** `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`, posiblemente `domus-beta-dbe/src/lib/agent/domus-agent.ts`.

**Criterios de aceptación:**
- [ ] “necesito 500 para Sofía super” crea la solicitud con forEntity/forName cuando Sofía es una entidad o miembro reconocible.
- [ ] Si no se puede resolver el nombre, la solicitud se crea igual sin forEntityId (comportamiento actual).

---

### C3. Reportes consumo: agrupar productos por similitud

**Objetivo:** En el reporte de consumo, que “AGUA 1L” y “Agua 1 L” (y variantes) cuenten como el mismo producto para totales y reposición.

**Alcance:**
- En `api/reports/consumption/route.ts`, después de construir productSums por clave `normalizeProductName(desc)|unit`, añadir un paso de agrupación: fuzzy match por descripción normalizada o embedding de descripción, y unificar bajo una clave canónica.
- Alternativa más simple: mejorar `normalizeProductName` (unificar “1L”/“1 L”, quitar acentos, colapsar espacios) y opcionalmente un segundo paso de grupos por distancia de Levenshtein en nombres cortos.

**Archivos:** `domus-beta-dbe/src/app/api/reports/consumption/route.ts`.

**Criterios de aceptación:**
- [ ] Dos líneas de extracción con descripción “AGUA 1L” y “Agua 1 L” y misma unidad se agrupan en una sola fila de producto con cantidad sumada.
- [ ] No se fusionan productos distintos (ej. “AGUA 1L” y “AGUA 2L” pueden seguir separados si se desea).

---

### C4. Sugerencias automáticas de ajuste de presupuesto (BudgetAdjustmentSuggestion)

**Objetivo:** Que el sistema proponga sugerencias de ajuste (subir límite, nueva categoría, etc.) basadas en el uso real, sin que el usuario tenga que crearlas a mano.

**Alcance:**
- Cron o job que periódicamente (ej. cada semana) o tras N transacciones revise por familia: gasto por categoría vs límite, recibos con comercios recurrentes sin categoría propia, etc.
- Crear registros en `BudgetAdjustmentSuggestion` con type y payload (ej. CHANGE_LIMIT, categoryId, newLimit sugerido; o NEW_CATEGORY, suggestedName). El admin las ve y aprueba/rechaza con el flujo actual.

**Archivos:** `domus-beta-dbe/src/app/api/cron/` (nuevo route o ampliar uno existente), `domus-beta-dbe/src/app/api/budget/suggestions/route.ts` (solo lectura/creación ya existe), lógica en `lib/budget/` o `lib/agent/`.

**Criterios de aceptación:**
- [ ] Al menos un tipo de sugerencia automática (ej. “límite superado en X, ¿subir a Y?”) se crea en condiciones definidas y aparece en la lista del admin.
- [ ] No se aprueba nada automáticamente; solo creación de sugerencias PENDING.

---

### C5. Validación de fechas en extracción de recibos

**Objetivo:** Evitar fechas futuras o absurdamente antiguas en recibos extraídos por OCR.

**Alcance:**
- En `lib/receipts/extract.ts` o en los consumidores (from-receipt, webhook): validar `extraction.date`; si es futura o anterior a N meses (ej. 12), no usarla como definitiva: devolver aviso o usar “hoy” como valor por defecto y marcar la extracción para revisión.
- Opcional: campo `receiptDateNeedsReview` o mensaje en la respuesta de extract/from-receipt.

**Archivos:** `domus-beta-dbe/src/lib/receipts/extract.ts` o `domus-beta-dbe/src/app/api/transactions/from-receipt/route.ts`, `domus-beta-dbe/src/app/api/receipts/[id]/extract/route.ts`.

**Criterios de aceptación:**
- [ ] Si la fecha extraída es futura, la transacción/recibo usa fecha de hoy (o se avisa y el usuario confirma).
- [ ] Si la fecha es muy antigua (ej. > 1 año), se avisa o se usa fecha por defecto.

---

### C6. Filtro de datos sensibles en mensajes

**Objetivo:** No persistir números de tarjeta ni contraseñas que alguien pegue en descripción o WhatsApp.

**Alcance:**
- Función `containsSensitiveData(text): boolean`: regex para patrones de tarjeta (4 bloques de 4 dígitos, Luhn opcional) y palabras clave + secuencia tipo contraseña.
- Antes de guardar descripción en transacción o motivo en money request o mensaje enviado al agente, comprobar; si true, no persistir el texto crudo (o sustituir por “[datos sensibles omitidos]”) y responder al usuario “No guardes datos sensibles por aquí”.

**Archivos:** `domus-beta-dbe/src/lib/` (nuevo módulo o en agent), `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`, `domus-beta-dbe/src/app/api/transactions/route.ts` (y from-receipt si se guarda descripción de usuario).

**Criterios de aceptación:**
- [ ] Un mensaje que contenga un número de tarjeta típico (16 dígitos) no se guarda tal cual en descripción/motivo; se avisa al usuario.
- [ ] No se marcan como sensibles textos normales (ej. “500 cine” o “compras”).

---

## Resumen de dependencias sugeridas

- **A1** puede hacerse sin las demás.
- **A2** mejora el agente; útil antes de B1 si se quiere que el agente siga siendo el fallback.
- **A3** y **B1** comparten webhook; se pueden hacer en paralelo o A3 primero para no duplicar lógica de “¿es gasto o solicitud?”.
- **B2** es independiente; **B3** se apoya en tener una función IA de categoría (reutilizable en A1).
- **C1–C6** son independientes entre sí y se pueden priorizar por gusto (C5 y C6 son rápidos y de seguridad/calidad).

---

## Cómo usar este documento

- Marcar tareas con `[x]` en criterios de aceptación cuando se cumplan.
- Para cada sprint, elegir 1–2 de Fase A o B y opcionalmente 1 de C.
- Detalle de implementación (prompts, umbrales) puede vivir en issues o en el propio código; este doc sirve como contrato de alcance y aceptación.
