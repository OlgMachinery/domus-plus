# Reporte completo: qué hace la IA en DOMUS

Resumen de **todas las funciones que usan inteligencia artificial** en el proyecto DOMUS (implementadas hoy y referencias a componentes opcionales).

---

## 1. Resumen ejecutivo

| Área | Qué hace la IA | Dónde está | Requiere |
|------|-----------------|------------|----------|
| **Recibos** | Extraer total, comercio, fecha, ítems, periodo (OCR + visión) | Web y WhatsApp | `OPENAI_API_KEY` |
| **Categorización** | Sugerir categoría o partida (entidad + categoría) para un recibo | Web (extracción) y WhatsApp (foto) | `OPENAI_API_KEY` |
| **WhatsApp** | Responder en lenguaje natural (consultas, cómo registrar, solicitudes) | Webhook WhatsApp | `OPENAI_API_KEY` |
| **Calendario** | Inferir pagos recurrentes y “próximo pago esperado” (sin LLM) | Calendario / API eventos | Solo datos |

La IA **no** crea transacciones por orden verbal ni ejecuta acciones destructivas; solo extrae datos, sugiere categorías y responde consultas.

---

## 2. Extracción de recibos (OCR + visión)

### Qué hace
- Toma **imagen o PDF** de un recibo (ticket, factura, servicio).
- Extrae con **OpenAI (modelo de visión)**:
  - **Total** a pagar (crítico).
  - **Comercio / beneficiario**, **fecha**, **hora**, **moneda**.
  - **Ítems** (renglones): descripción, cantidad, precio unitario, total por línea.
  - En recibos de **luz/agua**: tipo, cantidad consumida, unidad, **periodo de consumo** (inicio/fin).

### Dónde se usa
- **Web (domus-beta-dbe):** al subir recibo y pulsar “Extraer” → `POST /api/receipts/[id]/extract`.
- **WhatsApp:** cuando el usuario envía una **foto de recibo** → el webhook llama a la misma extracción y, si hay total válido, crea transacción y recibo.

### Archivos
- `domus-beta-dbe/src/lib/receipts/extract.ts`: prompts y llamada a OpenAI (modos `fast` / `precise`).
- `domus-beta-dbe/src/app/api/receipts/[id]/extract/route.ts`: API de extracción.
- `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`: flujo “imagen → extracción → categoría → transacción”.

### Configuración
- `OPENAI_API_KEY`: obligatorio para extracción.
- `OPENAI_RECEIPT_MODEL`: opcional (por defecto `gpt-4o-mini`).

### Salida
- Objeto normalizado: `ReceiptExtraction` + ítems (`ReceiptExtractionItem`). Incluye `rawText` para clasificación posterior.

---

## 3. Clasificación de categoría y partida

### Qué hace
- Dado **comercio + texto del recibo** y la **lista de categorías** (o partidas) de la familia:
  - Elige una **categoría existente** que encaje (ej. CFE → Servicios, super → Alimentos).
  - O sugiere **NUEVA: Nombre** si ninguna encaja (ej. “Repostería”).
- Opcionalmente sugiere **partida completa** (entidad + categoría) para asignar el gasto.

### Aprendizaje
- Si el usuario asigna un recibo a una categoría, se guarda **preferencia por comercio** (`FamilyCategoryPreference`: comercio normalizado → categoría). En futuros recibos del mismo comercio se usa esa categoría como hint (y la IA puede refinar con el texto).

### Dónde se usa
- **WhatsApp (foto de recibo):** después de extraer, se llama a `suggestCategoryForReceipt` o `suggestAllocationForReceipt`; con la sugerencia se crea la transacción (o se pide confirmación).
- **Web (flujo from-receipt):** en otros entornos (app, frontend) puede usarse lógica similar o reglas por comercio; en **domus-beta-dbe** la sugerencia de partida completa vía IA está en el agente y en el flujo de WhatsApp.

### Archivos
- `domus-beta-dbe/src/lib/agent/domus-agent.ts`:
  - `suggestCategoryForReceipt(merchantName, rawTextSnippet, categoryNames)` → categoría de la lista o `NUEVA: Nombre`.
  - `suggestAllocationForReceipt(...)` → `allocationId` (entidad + categoría) usando categoría sugerida por IA y mejor match.

### Configuración
- Mismo `OPENAI_API_KEY` y modelo que el agente (`OPENAI_AGENT_MODEL` o `OPENAI_RECEIPT_MODEL`).

---

## 4. Agente conversacional (WhatsApp)

### Qué hace
- Cuando el usuario envía un **mensaje de texto** que **no** es comando (ej. “500 cine Sofía”) ni imagen:
  - Se construye un **contexto**: nombre de familia, moneda, últimos 5 gastos, totales por categoría del mes, número de solicitudes pendientes.
  - Ese contexto + el mensaje se envían a **OpenAI** (chat completion).
  - La IA responde en **español**, breve: explica cómo registrar gastos, cuánto se ha gastado, cuántas solicitudes hay, cómo hacer una solicitud de efectivo, etc.

### Limitaciones
- **Solo lectura y explicaciones.** No ejecuta acciones: no crea transacciones por orden verbal ni aprueba solicitudes.
- No inventa datos; solo usa el contexto inyectado.

### Dónde se usa
- `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts`: si el mensaje no matchea parser de gasto ni de solicitud ni es imagen, se llama a `getAgentReply(...)` y se envía la respuesta por WhatsApp.

### Archivos
- `domus-beta-dbe/src/lib/agent/domus-agent.ts`:
  - `buildAgentContext(familyId, userId, userName)` → datos para el prompt.
  - `getAgentReply(message, familyId, userId, userName)` → respuesta en texto o `null` si falla/no hay API key.

### Configuración
- `OPENAI_API_KEY`.
- `OPENAI_AGENT_MODEL` o `OPENAI_RECEIPT_MODEL` (por defecto `gpt-4o-mini`).

---

## 5. Motor de pagos recurrentes (“motor IA” en producto)

### Qué hace
- **No usa LLM ni OpenAI.** Es un algoritmo sobre el historial de transacciones:
  1. Agrupa transacciones por **clave de recurrencia** (descripción normalizada + partida).
  2. Filtra grupos con al menos **3 ocurrencias** en los últimos meses (p. ej. 12).
  3. Calcula **intervalo mediano** entre fechas y **día del mes** más frecuente.
  4. Si el intervalo es ~mensual (25–35 días), considera el grupo “recurrente”.
  5. Predice **próxima fecha esperada** y **monto sugerido** (mediana de montos).

### Dónde se usa
- **Calendario unificado:** `GET /api/calendar/events` (time-engine) incluye “pagos esperados” con tipo `payment_expected`.
- **API de pagos:** `GET /api/calendar/payments` también usa este motor para `upcoming`.

### Archivos
- `domus-beta-dbe/src/lib/calendar/recurring-engine.ts`:
  - `detectRecurringPayments(familyId, options)` → lista de recurrentes con próxima fecha y monto.
  - `getUpcomingExpectedPayments(familyId, from, to)` → solo los esperados en el rango que aún no tienen transacción.

### Configuración
- No requiere API keys; solo base de datos (transacciones de la familia).

---

## 6. Consumo (reportes de consumo y utilidades)

### Qué aporta la IA al consumo
- **Datos de entrada:** Los reportes de consumo se alimentan de **ítems y datos que la IA extrae** de los recibos:
  - **Ítems de ticket/super/farmacia:** descripción, cantidad, unidad (`quantityUnit`): lo extrae la visión (OpenAI) en `extract.ts`. Con eso se arman totales por producto (“cuánto tomate”, “cuánta mayonesa”) y reposición (días entre compras).
  - **Luz/agua:** en recibos de servicios, la extracción puede devolver `consumptionQuantity`, `consumptionUnit`, `consumptionPeriodStart`/`End`. Eso alimenta la pestaña de **utilidades** (kWh, m³ por periodo) en Reportes → Consumo.

### Qué no usa IA (solo reglas)
- **Normalización y agrupación:** En el reporte no hay LLM. Se usa `normalizeProductName()` (regex: minúsculas, quitar acentos, “1 L” → “1l”, quitar precios al final) y `productKey(descripción, unidad)` para agrupar. Variantes como “AGUA 1L” y “Agua 1 L” se unifican por esas reglas; si el texto es muy distinto, pueden quedar como productos separados.
- **Anomalías (precio/consumo):** `price-analysis.ts` detecta, por ejemplo, consumo por encima del promedio histórico (utilidades); es lógica numérica, no IA.

### Mejora posible con IA (no implementada)
- **Agrupar variantes del mismo producto:** usar fuzzy match o embeddings para que “Mayonesa 500g”, “MAYONESA 500 G” y “mayonesa 500gr” cuenten como un solo producto en totales y reposición (hoy depende de que `normalizeProductName` los deje iguales).

### Archivos
- `domus-beta-dbe/src/app/api/reports/consumption/route.ts`: API del reporte (productos, agrupado, utilidades, reposición).
- `domus-beta-dbe/src/lib/consumption/normalize.ts`: `normalizeProductName`, `normalizeUnit`, `productKey`.
- `domus-beta-dbe/src/lib/consumption/price-analysis.ts`: anomalías en utilidades.
- `domus-beta-dbe/docs/REPORTES_DE_CONSUMO.md`: diseño y extensión de la extracción para consumo.

---

## 7. Otros componentes que mencionan IA (opcionales o en otros módulos)

| Componente | Descripción | Ubicación |
|------------|-------------|-----------|
| **AI Assistant (backend Python)** | Asistente con GPT: preguntas sobre el sistema, consejos financieros, análisis. Incluye `predict_future_expenses`. | `backend/app/services/ai_assistant.py` (requiere `openai` y `OPENAI_API_KEY`) |
| **Predict expenses (TypeScript)** | Predicción de gastos futuros a partir de transacciones. | `lib/services/ai-assistant.ts`, `app/api/ai-assistant/predict-expenses/route.ts` (no usado en domus-beta-dbe por defecto) |
| **Procesamiento de recibos (app/frontend)** | Algunas rutas de `app/api/receipts/process` o `frontend` usan o invocan extracción/clasificación con IA (OpenAI). | `app/api/receipts/process/route.ts`, `frontend/` (según migración) |
| **Backend receipt_processor (Python)** | OCR + GPT Vision para extracción; categorías fijas en prompt. | `backend/app/services/receipt_processor.py`, `FLUJO_EXTRACCION_DATOS.md` |

En **domus-fam.com** (domus-beta-dbe) la IA activa es la de los puntos 2–4 (extracción, categorización, agente WhatsApp) más el motor de recurrentes (punto 5).

---

## 8. Variables de entorno resumidas

| Variable | Uso |
|----------|-----|
| `OPENAI_API_KEY` | Extracción de recibos, sugerencia de categoría/partida, agente WhatsApp. **Obligatoria** para esas funciones. |
| `OPENAI_RECEIPT_MODEL` | Modelo para extracción y, si no se define el de agente, para agente (default: `gpt-4o-mini`). |
| `OPENAI_AGENT_MODEL` | Modelo para el agente conversacional (opcional). |

Sin `OPENAI_API_KEY`, la app sigue funcionando pero: no se puede extraer desde imagen, no hay sugerencia de categoría por IA y el agente WhatsApp devuelve null (se puede mostrar un mensaje fijo o pedir texto estructurado).

---

## 9. Referencias en el repositorio

| Tema | Archivo o doc |
|------|----------------|
| Agente y sugerencia de categoría | `domus-beta-dbe/src/lib/agent/domus-agent.ts` |
| Extracción de recibos | `domus-beta-dbe/src/lib/receipts/extract.ts` |
| Webhook WhatsApp (flujos, imagen, agente) | `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts` |
| Motor recurrentes | `domus-beta-dbe/src/lib/calendar/recurring-engine.ts` |
| Calendario unificado (eventos con esperados) | `domus-beta-dbe/src/lib/calendar/time-engine.ts`, `docs/TIME_ENGINE_API.md` |
| Visión general IA en DOMUS | `docs/IA_EN_COLUMNA_VERTEBRAL_DOMUS.md` |
| Calendario y “motor IA” | `docs/CALENDARIO_PAGOS_IA.md` |
| Propuesta agente (acciones futuras) | `docs/PROPUESTA_AGENTE_IA_DOMUS.md` |

---

## 10. Resumen en una frase

**En DOMUS la IA se usa para: (1) extraer datos de recibos con visión, (2) sugerir categoría o partida para ese recibo, (3) responder por WhatsApp en lenguaje natural con contexto de la familia; además, un motor algorítmico (sin LLM) infiere pagos recurrentes para el calendario.**
