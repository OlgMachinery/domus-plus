# Duplicados y recibos viejos / de otras partes

Cómo DOMUS controla posibles duplicados y fechas de recibos (viejos, futuros u de otras fuentes).

---

## 1. Detección de posibles duplicados (aviso, no bloqueo)

### Qué hace
- Al **crear una transacción** (manual o desde recibo), después de guardar se busca si ya existe otra transacción de la misma familia que **pueda ser la misma**:
  - **Monto:** igual o muy parecido (±2% o ±2 pesos, el que sea mayor).
  - **Fecha:** en una ventana de **14 días hacia atrás** y **2 días hacia delante** de la fecha de la transacción nueva.
  - **Descripción/comercio (opcional):** si se pasa descripción, se elige el candidato cuya descripción coincida mejor (una contiene a la otra en minúsculas).

### Comportamiento
- **No bloquea:** la transacción se crea siempre. Si hay un candidato, la API devuelve un **aviso** (`duplicateWarning`) con: `transactionId`, `date`, `description`, `amount` del gasto que podría ser el mismo.
- La idea es que la app muestre algo como: *"¿Es el mismo gasto? Ya existe uno del 5/3 por $500 – [ver]"* para que el usuario decida si elimina el duplicado o lo deja.

### Dónde se usa
- **POST /api/transactions** (gasto manual): tras crear, llama a `findPossibleDuplicate` y devuelve `duplicateWarning` en el JSON si hay candidato.
- **POST /api/transactions/from-receipt** (gasto desde recibo/foto): igual, devuelve `duplicateWarning` en la respuesta.

### Archivos
- `domus-beta-dbe/src/lib/dedup.ts`: `findPossibleDuplicate()`, constantes `DAYS_LOOKBACK=14`, tolerancia de monto.
- `domus-beta-dbe/src/app/api/transactions/route.ts`: uso tras crear transacción manual.
- `domus-beta-dbe/src/app/api/transactions/from-receipt/route.ts`: uso tras crear transacción desde recibo.

### Brecha actual en la UI
- La API **sí** devuelve `duplicateWarning`, pero la pantalla **no** muestra aún ese aviso. Para que el usuario lo vea habría que, en la respuesta de crear gasto (manual o from-receipt), leer `data.duplicateWarning` y mostrar un mensaje/alert con enlace al gasto existente.

---

## 2. Recibos viejos o con fecha futura (ajuste de fecha)

### Qué hace
- En **from-receipt** (crear gasto desde recibo/foto), la **fecha del gasto** se toma de la fecha extraída del recibo por la IA.
- Para evitar recibos **muy viejos** o de **otras partes** (o errores de OCR con fecha futura), se aplica la regla **C5**:
  - Si la fecha extraída es **futura** → se usa **hoy** como fecha de la transacción.
  - Si la fecha extraída es **anterior a 12 meses** → se usa **hoy** como fecha de la transacción.
- No se muestra un warning explícito al usuario cuando se corrige la fecha; la transacción se guarda con la fecha ajustada (hoy). Opcionalmente se podría devolver en la respuesta algo como `dateAdjusted: true` y mostrarlo en la UI.

### Dónde está
- `domus-beta-dbe/src/app/api/transactions/from-receipt/route.ts` (aprox. líneas 142–151): `receiptDate` se ajusta antes de usarlo como `txDate`.

### Resumen
- **Recibos viejos (>12 meses):** la transacción se registra con fecha de **hoy**, no con la del ticket.
- **Recibos con fecha futura (error OCR):** igual, se usa **hoy**.
- **Recibos de “otras partes”:** no hay detección por origen (otra familia/otro país). El control es por familia (solo se buscan duplicados dentro de la misma familia). Si quisieras avisar por “mismo comercio + mismo monto en otro periodo”, sería una extensión (p. ej. ampliar ventana de fechas o incluir comercio en la búsqueda de duplicados).

---

## 3. Otros controles relacionados

- **Datos sensibles:** En **POST /api/transactions** se usa `containsSensitiveData(description)`. Si la descripción parece contener tarjeta o contraseña, se **borra** la descripción y la API devuelve `sensitiveWarning` para que la UI pueda mostrar: *"No guardamos datos sensibles. La descripción fue omitida."* (la UI tampoco muestra aún este aviso de forma explícita en todos los flujos.)
- **Duplicados en extracción (ítems):** En `lib/receipts/extract.ts` hay lógica para evitar **ítems duplicados en los bordes** al unir varias partes de un recibo largo (`isProbableBoundaryDuplicate`). Eso evita líneas repetidas en la extracción, no duplicados de transacciones.

---

## 4. Mejoras posibles

1. **Mostrar el aviso de duplicado en la UI** cuando la API devuelve `duplicateWarning` (y opcionalmente `sensitiveWarning`), con enlace al gasto existente.
2. **Opcional:** Devolver `dateAdjusted: true` cuando se corrige la fecha (vieja/futura) en from-receipt y mostrarlo: *"La fecha del recibo se registró como hoy (recibo fuera de rango)."*
3. **Opcional:** Ampliar la detección de duplicados (p. ej. incluir comercio/descripción en la búsqueda o ventana de días configurable) o permitir “fusionar” con el gasto existente desde la UI.
