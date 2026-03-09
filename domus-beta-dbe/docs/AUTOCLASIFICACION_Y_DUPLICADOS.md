# Autoclasificación y duplicados en comprobantes

## Autoclasificación por IA

### Cómo funciona hoy

- Al subir un comprobante (web o WhatsApp), el sistema extrae con IA: total, comercio, fecha, texto.
- La **categoría** se asigna así:
  1. **Preferencia aprendida:** si el comercio (ej. "HEB Norte") ya tiene categoría guardada para la familia, se usa esa.
  2. **IA:** `suggestCategoryForReceipt(merchantName, rawTextSnippet, categoryNames)` pide a OpenAI elegir una categoría de la lista o proponer una nueva (`NUEVA: Nombre`).
  3. **Fallback:** reglas por palabras (ej. supermercado, gasolina, farmacia) en `resolveCategoryHint` y en la API `inferCategoryHint`.

### Mejoras implementadas

- **Prompt más estricto:** se pide a la IA que responda “ÚNICAMENTE con el nombre exacto de una categoría de la lista (copiando tal cual)”.
- **Temperature 0:** respuestas más estables y reproducibles.
- **Validación de respuesta:** coincidencia exacta normalizada; si no hay, se busca por inclusión (que el texto elegido contenga o esté contenido en una categoría). Así se corrige cuando la IA añade puntuación o pequeñas variaciones.

### Sugerencias para seguir mejorando

1. **Revisar categorías en la app:** si la familia tiene nombres muy parecidos (ej. "Comida" y "Comida y bebida"), la IA puede equivocarse; conviene nombres bien diferenciados.
2. **Aprender de correcciones:** cuando el usuario cambia la categoría de un gasto en la app, se podría actualizar la preferencia por comercio (hoy solo se aprende al clasificar por primera vez).
3. **Modelo:** `OPENAI_RECEIPT_MODEL` (por defecto `gpt-4o-mini`) se puede cambiar a un modelo más capaz si se prioriza precisión sobre costo.

---

## Duplicados

### Comportamiento actual

- **Detección:** antes de crear la transacción se busca un gasto reciente (±14 días, monto ±5% o ±5 pesos, y opcionalmente descripción/comercio similar). Ver `src/lib/dedup.ts`.
- **Web (subir comprobante):**
  - Si hay posible duplicado, la API responde **409** con `code: 'POSSIBLE_DUPLICATE'` y **no** crea la transacción.
  - La UI muestra el aviso: “Posible duplicado. ¿Descartar o registrar de todos modos?” con botones **Descartar** y **Registrar de todos modos** (reenvía con `forceDuplicate=1`).
- **WhatsApp:**
  - Si hay posible duplicado, **no** se crea la transacción.
  - Se envía al usuario un **recibo rojo** (misma estructura que el ticket verde pero en rojo, con “RECHAZADO — Duplicado”) y el mensaje: “Posible duplicado (ya existe un gasto similar: $X, fecha). ¿Descartar o enviar el comprobante correcto? Responde *DESCARTA* o envía la foto correcta.”

### Recibo rojo

- Imagen generada en `src/lib/receipts/ticket-image.ts`: `generateRejectedTicketImagePng(data, reason)`.
- Estilo: fondo rosa claro, borde y textos en rojo, título “RECHAZADO — Duplicado” (o el `reason` que se pase).
- Se usa en WhatsApp al detectar duplicado; en web el aviso es el bloque de texto con botones (no se genera imagen por defecto; se podría añadir si se desea).

### Sugerencias

1. **WhatsApp – respuestas a “DESCARTA”:** opcionalmente interpretar un mensaje de texto “DESCARTA” como confirmación de que el usuario descarta el comprobante duplicado (hoy no se guarda estado; el usuario simplemente no reenvía).
2. **Umbral de duplicado:** en `dedup.ts`, `AMOUNT_TOLERANCE_PCT` (5%) y `DAYS_LOOKBACK` (14) se pueden ajustar si hay muchos falsos positivos o se quieren detectar duplicados en un rango más amplio.
3. **Recibo rojo en web:** si se quiere la misma experiencia que en WhatsApp, la API 409 podría devolver una URL firmada del recibo rojo (generándolo en servidor y subiéndolo a Spaces) para mostrarlo en el modal de duplicado.
