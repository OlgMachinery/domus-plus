# IA en la columna vertebral de DOMUS

Resumen de **dónde ya interviene la IA** en el core de DOMUS y **qué más puede hacer** sin cambiar la estructura del producto.

---

## 1. Columna vertebral actual (flujos críticos)

| Capa | Qué hace | Dónde está |
|------|----------|------------|
| **Auth + Familia** | Registro, sesión, miembros, admin | `api/auth/*`, `api/families/members/*` |
| **Transacciones** | Crear gasto (manual, desde recibo, desde WhatsApp texto/imagen) | `api/transactions/*`, `api/transactions/from-receipt` |
| **Recibos** | Subir imagen/PDF → extraer total, comercio, ítems, fechas | `api/receipts/[id]/extract`, `lib/receipts/extract.ts` |
| **Categorización** | Asignar recibo/gasto a partida (entidad + categoría) | `domus-agent.ts` → `suggestCategoryForReceipt`, preferencias por comercio |
| **WhatsApp** | Texto → parser "500 cine Sofía"; imagen → OCR + transacción; mensaje libre → agente | `api/whatsapp/webhook` |
| **Presupuesto** | Entidades, categorías, asignaciones, sugerencias | `api/budget/*` |
| **Solicitudes de efectivo** | Crear, aprobar, entregar | `api/money-requests/*` |
| **Reportes** | Consumo, tablas, export | `api/reports/*` |

La IA ya toca **transacciones**, **recibos** y **atención por WhatsApp**; el resto es lógica y datos.

---

## 2. Dónde la IA ya ayuda (hoy)

- **Extracción de recibos (OCR)**  
  `extractReceiptFromImageBytes` / `extractReceiptFromImageParts`: total, comercio, fecha, ítems, tipo (ticket/servicio), periodo de consumo. Entrada: imagen o PDF; salida: `ReceiptExtraction` + ítems. Usado en web (subir recibo, “Extraer”) y en WhatsApp (foto → transacción).

- **Clasificación de categoría**  
  `suggestCategoryForReceipt`: dado comercio + texto del recibo y lista de categorías de la familia, devuelve categoría existente o “NUEVA: Nombre”. Se aprende por comercio (`FamilyCategoryPreference`) para futuros recibos del mismo sitio.

- **Agente conversacional (WhatsApp)**  
  `getAgentReply`: mensaje de texto que no es comando ni imagen → se envía al agente con contexto (familia, moneda, últimos 5 gastos, solicitudes pendientes). Responde en lenguaje natural: “¿cuánto gastamos?”, “¿cómo registro un gasto?”, “solicitudes pendientes”, etc. Solo lectura + explicaciones; no ejecuta acciones (no crea transacciones por orden verbal aún).

---

## 3. Qué más puede hacer la IA en la columna vertebral

Ideas alineadas al core: **más datos correctos**, **menos fricción** y **más seguridad/coherencia**, sin sustituir la lógica de negocio.

### 3.1 Calidad y coherencia de datos

- **Detección de duplicados**  
  Al crear transacción (manual o desde recibo): comparar monto + fecha + comercio/descripción (o embedding de descripción) con transacciones recientes; avisar “¿Es la misma que la del 5/3?” o sugerir fusionar. Reduce duplicados por doble captura o recibo ya registrado.

- **Normalización de descripciones**  
  IA sugiere descripción corta y uniforme a partir de “CFE MAR ABR 2025” o texto largo del recibo (ej. “Luz CFE marzo-abril”). Mejora reportes y búsqueda sin tocar el flujo actual.

- **Validación de fechas**  
  En recibos: si la fecha extraída es futura o muy antigua respecto al día de subida, avisar o pedir confirmación. Evita errores de OCR o de periodo.

### 3.2 Automatización en el flujo actual

- **Asignación automática a entidad (quién)**  
  Hoy la categoría se sugiere por IA; la **entidad** (persona/casa/etc.) a veces se infiere por “para Sofía” en WhatsApp. Se puede extender: con descripción + historial de quién paga qué, sugerir “¿Asignar a Sofía?” al crear la transacción (en app o al procesar recibo).

- **Sugerencia de partida completa**  
  En un solo paso: dado recibo o “500 cine”, sugerir **entidad + categoría** (ej. “Sofía – Entretenimiento”) usando preferencias y contexto. El usuario solo confirma o corrige.

- **Recordatorios y seguimiento**  
  Cron ya existe (`api/cron/reminders`). La IA puede redactar el mensaje (WhatsApp o notificación): “Tienes 2 solicitudes pendientes: Juan 500, María 300. Revisa en DOMUS.” O “Este recibo de super no tiene categoría asignada.”

### 3.3 Agente: de “solo responde” a “puede actuar”

- **Registro por lenguaje natural**  
  Si el usuario escribe “registra 500 cine para Sofía” o “anota 1200 farmacia”, el agente (o un paso previo de intención) puede devolver una **acción estructurada** (`register_expense`, monto, concepto, entidad) y el backend la ejecuta; luego el agente confirma en lenguaje natural. Sigue siendo un solo flujo: mensaje → backend → respuesta.

- **Consultas que requieren más contexto**  
  Hoy el agente solo ve últimos 5 gastos y número de solicitudes. Se puede ampliar el contexto (totales por categoría este mes, resumen por entidad) o un endpoint “resumen” que el agente llame o que se inyecte en el prompt cuando el usuario pida “resumen del mes” o “cuánto en super”.

- **Solicitud de efectivo por chat**  
  “Necesito 500 para super” → parsear monto + motivo (opcional) y crear `MoneyRequest`; el agente responde “Solicitud de 500 creada. Te avisamos cuando la aprueben.”

### 3.4 Seguridad y buenas prácticas

- **Detección de mensajes sensibles**  
  En WhatsApp o en textos de descripción: no guardar ni repetir datos muy sensibles (contraseñas, números de tarjeta completos). Solo avisar “No guardes datos de tarjetas por aquí” y no persistir ese contenido.

- **Resumen de permisos en respuestas**  
  El agente ya conoce el contexto de la familia; puede recordar “Solo los admins pueden aprobar solicitudes” o “Puedes ver todos los gastos; para editar presupuesto necesitas ser admin.”

---

## 4. Orden sugerido (sin romper la columna vertebral)

1. **Corto plazo (solo prompt + contexto)**  
   - Enriquecer contexto del agente (totales por categoría, resumen del mes) para preguntas tipo “¿cuánto en super?”.  
   - Mensaje de recordatorio redactado por IA (solicitudes pendientes, recibos sin categoría).

2. **Medio plazo (una acción nueva)**  
   - “Registra X concepto [para Y]” por WhatsApp → acción `register_expense` ejecutada por el backend; agente confirma.  
   - “Solicitud 500 motivo” → crear `MoneyRequest` desde el webhook; agente confirma.

3. **Después (calidad de datos)**  
   - Detección de duplicados al crear transacción.  
   - Sugerencia de entidad además de categoría (partida completa).  
   - Normalización de descripción opcional al guardar.

Todo se puede hacer **añadiendo llamadas a la IA y pequeños cambios en el backend**, sin reescribir auth, familias, transacciones ni recibos. La columna vertebral sigue siendo la misma; la IA la hace más útil y fiable.

---

## 5. Inspección profunda: puntos concretos del core

Revisión fina del código (webhook, from-receipt, transacciones, reportes, presupuesto) para localizar **reglas fijas o heurísticas** que la IA puede mejorar sin cambiar contratos ni modelos.

### 5.1 Parsers y resolución de intención (WhatsApp)

| Qué | Dónde | Límite actual | Mejora con IA |
|-----|-------|----------------|---------------|
| **Gasto por texto** | `parseTextMessage`: `^\s*(\d+)\s+([\s\S]+)$` | Solo “500 cine Sofía”. No acepta “gasté 500 en cine”, “500 pesos para Sofía cine”, “cine 500”. | Un paso de normalización con IA: texto libre → `{ amount, concept, recipientName }` y seguir con el flujo actual. |
| **Solicitud de efectivo** | `parseMoneyRequestIntent`: 3 regex (“solicitud 500 cine”, “necesito 500 …”, “quiero 500 …”) | “Me prestas 500 super”, “dame 300 para farmacia”, “advance 200 gas” no matchean → caen al agente o fallback. | Detección de intención (clasificador o LLM): “¿es solicitud de efectivo?” + extracción de monto y motivo; mismo flujo de creación de `MoneyRequest`. |
| **Concepto → categoría** | `resolveCategoryHint` + `CONCEPT_TO_CATEGORY` (diccionario estático ~60 entradas) | Cualquier concepto nuevo (gimnasio, netflix, streaming, gasolina, etc.) no resuelve; se usa el concepto crudo en `findAllocationWithDetails`. | IA: concepto + lista de categorías de la familia → categoría existente o “sugerir nueva”. Reutilizar lógica tipo `suggestCategoryForReceipt` para texto corto. |
| **Reasignar por clave** | `parseConceptAndEntityForReassign`: última palabra = entidad si no está en CONCEPT_TO_CATEGORY | “E-ABC12 cumpleaños mamá” puede fallar si “mamá” no es nombre de entidad; ambigüedad concepto vs persona. | IA: dado “cumpleaños mamá” y lista de entidades/miembros, devolver `{ categoryHint, entityHint }` de forma consistente. |

### 5.2 Asignación a partida (entidad + categoría)

| Qué | Dónde | Límite actual | Mejora con IA |
|-----|-------|----------------|---------------|
| **findAllocationWithDetails** | webhook: scoring por substring (entity name, category name) + sinónimos fijos (“comida”, “eventos familiares”) | Si la familia tiene categorías con otros nombres (ej. “Alimentos”, “Fiestas”), el match puede ser el primero de la lista, no el más adecuado. | IA: “concepto + motivo” y lista de asignaciones (entidad + categoría) → devolver la `allocationId` más plausible. Una llamada por mensaje cuando hay ambigüedad. |
| **from-receipt (web)** | `inferCategoryHint` (regex HEB, PEMEX, FARMACIA, etc.) + `scoreAllocation` (reglas: supermercado→HOUSE, gasolina→VEHICLE) | Solo unas pocas cadenas; familias con categorías distintas (ej. “Despensa”, “Auto”) no se benefician. | Usar `suggestCategoryForReceipt` (o equivalente) también en from-receipt web y sugerir **allocationId completo** (entidad + categoría), no solo categoría; alinear con el flujo de WhatsApp imagen. |
| **Solicitud de efectivo (WhatsApp)** | `categoryHint = resolveCategoryHint(reason) || reason`; `entityNameHint: null` | No se infiere “para quién” desde el texto (ej. “necesito 500 para Sofía super”); la solicitud queda sin `forEntityId`/`forName`. | IA: extraer “para [nombre]” del motivo y mapear a entidad de la familia; setear `forEntityId`/`forName` cuando sea posible. |

### 5.3 Transacciones y recibos

| Qué | Dónde | Límite actual | Mejora con IA |
|-----|-------|----------------|---------------|
| **Transacción manual (POST /api/transactions)** | El usuario elige `allocationId` en un dropdown; no hay sugerencia inicial. | Siempre mismo orden de partidas; no se pre-selecciona la más usada recientemente por el usuario o por concepto. | Al cargar el formulario (o al escribir concepto): sugerir allocationId (p. ej. última usada por ese usuario, o partida que más coincida con un concepto si se añade campo “concepto” previo). Opcional: una llamada ligera de IA para “concepto → partida”. |
| **Detección de duplicados** | No existe. | Doble captura (mismo recibo dos veces, o manual + foto) genera dos transacciones. | Al crear transacción (manual o from-receipt): buscar recientes por familia con monto ±tolerancia, fecha cercana, descripción/comercio similar (o embedding); si hay candidato, devolver aviso “¿Es la misma que …?” y opción de no crear. |
| **Extracción de recibos** | `extract.ts`: total, comercio, ítems; si no hay total válido se devuelve error. | No hay “confidence” ni reintento con otro crop/modelo; el usuario solo puede re-subir. | Opcional: score de confianza (p. ej. según consistencia total vs suma ítems); si bajo, marcar extracción como “revisar” o sugerir “Revisa el total”. Retry con otro crop o modelo en modo “precise” si el primero falla. |
| **Fecha del recibo** | Se usa la fecha extraída tal cual. | OCR puede devolver fecha futura o muy antigua; no hay validación ni sugerencia de corrección. | Validar rango (p. ej. no futura, no > N meses atrás); si falla, avisar y opcionalmente pedir confirmación o sugerir “fecha de hoy”. |

### 5.4 Reportes y consumo

| Qué | Dónde | Límite actual | Mejora con IA |
|-----|-------|----------------|---------------|
| **normalizeProductName** | `api/reports/consumption`: regex para quitar precios/códigos al final, espacios. | “AGUA 1L” y “Agua 1 L” pueden quedar como productos distintos; no hay agrupación por similitud semántica. | Agrupar variantes del mismo producto: fuzzy match o embedding de descripción; una clave canónica por “producto equivalente” para totales y reposición. |
| **Resumen en lenguaje natural** | No existe. | El reporte de consumo son tablas y números; el agente solo tiene últimos 5 gastos. | Endpoint o capa “resumen del periodo” (por categoría, por entidad, mayor gasto) y/o inyectarlo en el contexto del agente cuando preguntan “¿cuánto en super?” o “resumen del mes”. |

### 5.5 Presupuesto y sugerencias

| Qué | Dónde | Límite actual | Mejora con IA |
|-----|-------|----------------|---------------|
| **BudgetAdjustmentSuggestion** | Solo se crean manualmente (POST con type + payload). | No hay sugerencias automáticas de ajuste. | IA proactiva (cron o tras N transacciones): “Has gastado >80% en Super este mes”, “Varios recibos de Farmacia X sin categoría dedicada” → crear sugerencias tipo SUBDIVIDE_CATEGORY, NEW_CATEGORY o CHANGE_LIMIT para que el admin apruebe o rechace. |
| **Default entities** | `seedDefaultBudgetEntitiesForFamily`: “Persona 1”, “Persona 2”, “Comida (Familia)”, etc. | Nombres genéricos; el usuario los renombra después. | Opcional: al registrar, sugerir nombres (ej. del usuario que crea la familia + “y familia”) para las primeras entidades; mantener por defecto actual si no se quiere tocar el flujo de registro. |

### 5.6 Seguridad y UX en mensajes

| Qué | Dónde | Límite actual | Mejora con IA |
|-----|-------|----------------|---------------|
| **Datos sensibles** | No se filtra contenido de mensajes antes de guardar. | Si alguien pega número de tarjeta o contraseña en descripción/WhatsApp, se persiste. | Filtro ligero (regex o modelo pequeño): detectar patrones de tarjeta/contraseña; no persistir ese contenido y responder “No guardes datos sensibles por aquí”. |
| **“Para mamá” / “para mi esposa”** | Matching de destinatario por nombre en `familyMembers`. | “Para mamá”, “para mi esposa” no matchean con ningún nombre; no hay mapeo alias → usuario. | Opcional: mapeo manual “mamá → María” en perfil o familia; o IA que, con lista de miembros, resuelva “mamá”/“esposa” si hay solo una persona que pueda ser (ej. única mujer en la familia). |

### 5.7 Resumen de prioridad (inspección profunda)

- **Alto impacto, poco cambio:**  
  - Unificar asignación recibo (from-receipt web) con IA como en WhatsApp (sugerir partida completa).  
  - Enriquecer contexto del agente (totales por categoría / resumen) y/o endpoint de resumen.  
  - Detección de intención de solicitud de efectivo por IA (más variantes de “necesito X para Y”).

- **Alto impacto, cambio medio:**  
  - Normalizar mensaje de gasto por texto con IA (“gasté 500 cine” → mismo flujo que “500 cine”).  
  - Detección de duplicados al crear transacción.  
  - Resolver concepto → categoría con IA en webhook (sustituir o complementar CONCEPT_TO_CATEGORY).

- **Refinamiento:**  
  - Reasignar: entityHint + categoryHint por IA.  
  - Solicitud de efectivo: extraer “para [nombre]” y setear forEntityId.  
  - Reportes consumo: agrupar productos por similitud.  
  - Sugerencias automáticas de ajuste de presupuesto (BudgetAdjustmentSuggestion).  
  - Validación de fechas en extracción y filtro de datos sensibles.

---

## 6. Referencias en el repo

| Tema | Archivo / doc |
|------|----------------|
| Agente (respuesta, contexto) | `domus-beta-dbe/src/lib/agent/domus-agent.ts` |
| Sugerencia de categoría | `suggestCategoryForReceipt` en domus-agent.ts |
| Webhook WhatsApp (flujos, parsers, CONCEPT_TO_CATEGORY) | `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts` |
| Extracción de recibos | `domus-beta-dbe/src/lib/receipts/extract.ts` |
| From-receipt (inferCategoryHint, scoreAllocation) | `domus-beta-dbe/src/app/api/transactions/from-receipt/route.ts` |
| Reportes consumo (normalizeProductName) | `domus-beta-dbe/src/app/api/reports/consumption/route.ts` |
| Sugerencias de presupuesto | `domus-beta-dbe/src/app/api/budget/suggestions/route.ts` |
| Default entidades presupuesto | `domus-beta-dbe/src/lib/budget/defaults.ts` |
| Propuesta agente (acciones, chat) | `docs/PROPUESTA_AGENTE_IA_DOMUS.md` |
| Contexto proyecto | `docs/CONTEXTO_CHAT_DOMUS_MARZO_2026.md` |
| **Tareas concretas (backlog)** | **`docs/TAREAS_IA_CORE_DOMUS.md`** |
