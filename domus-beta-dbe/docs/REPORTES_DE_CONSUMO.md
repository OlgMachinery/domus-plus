# Reportes de consumo e historial de consumos

## Principio: todo basado en la extracción de datos del recibo

**La fuente de verdad es la extracción (IA)** de cada recibo. Recibo de luz, de agua, del super, farmacia, etc. — lo que la IA extrae del ticket es lo que alimenta:

- **Historial de consumos** (kWh, m³, productos comprados con cantidad y unidad).
- **Reposición**: calcular cuánto duró un producto (ej. mayonesa 500 g: compra 1/ene, siguiente compra 15/ene → duró 14 días; o cuántos gramos/kilos por periodo).

Con ayuda de la IA se puede:

1. **Recibo de luz** → extraer: consumo en kWh, periodo (inicio–fin), compañía, monto.
2. **Recibo de agua** → extraer: consumo en m³ (o litros), periodo, monto.
3. **Recibos de alimentos / super** → en cada línea: producto (ej. “Mayonesa”), cantidad y unidad (500 g, 1 kg, 2 L), precio; así se sabe “cuánta mayonesa” y en qué fecha.
4. **Farmacia** → producto, cantidad, para quién (si se asigna la transacción a un usuario).

Esa extracción enriquecida se guarda y se usa para **historial de consumos** y **reposición**.

---

## Qué tenemos hoy en la extracción

- **ReceiptExtraction**: comercio, fecha, total, moneda, tax, tip, rawText, meta.
- **ReceiptExtractionItem**: por cada renglón del ticket: descripción, cantidad, precio unitario, monto, raw_line.

La IA ya devuelve items con `quantity_raw`, `unit_price_raw`, `total_raw` y descripción. Falta:

- **Normalizar cantidad + unidad** en las líneas (ej. “500 g”, “1 kg”, “2 L”) para poder sumar “gramos de mayonesa” o “litros de X”.
- **Para recibos de servicios (luz, agua)**: detectar tipo de recibo y extraer **consumo** (kWh, m³) y **periodo** (fechas de facturación), no solo el total.

---

## Extensión de la extracción (IA) para consumo

### 1. Recibos de luz / agua (servicios)

En el prompt o en un paso posterior, pedir a la IA que, si identifica recibo de **electricidad** o **agua**, devuelva algo como:

```json
{
  "receipt_type": "utility",
  "utility_type": "electricity",
  "consumption_quantity": 150,
  "consumption_unit": "kWh",
  "period_start": "2025-01-01",
  "period_end": "2025-01-31"
}
```

(o `"water"` y unidad `"m3"` / `"L"`). Así cada recibo de luz/agua aporta un **registro de consumo** con cantidad, unidad y periodo.

### 2. Líneas de productos (alimentos, etc.)

En cada item, además de descripción y precios, que la IA intente extraer **cantidad y unidad** normalizadas:

- `quantity`: número (ej. 500, 1, 2).
- `unit`: `"g"`, `"kg"`, `"L"`, `"ml"`, `"unidades"`, etc., inferido de la descripción o de `raw_line` (ej. “MAYONESA 500G” → 500, g).

Opcional: `product_normalized` (ej. “Mayonesa”) para agrupar variantes (“Mayonesa 500g”, “Mayonesa 1kg”).

Con eso se construye **historial de compras por producto** (qué, cuánto, cuándo, quién si está asignada la transacción).

---

## Historial de consumos (base de datos / modelo)

A partir de la extracción se puede generar un **historial de consumos**:

- **Por servicio (luz, agua):** una fila por recibo con: familia, fecha, tipo (luz/agua), cantidad, unidad, periodo_inicio, periodo_fin, transactionId/receiptId.
- **Por producto:** una fila por línea relevante (o por transacción) con: familia, fecha, producto (o descripción normalizada), cantidad, unidad, usuario (si aplica), transactionId, receiptExtractionItemId.

Opciones de modelo:

- **Opción A – Solo extracción enriquecida:** ampliar **ReceiptExtraction** (y opcionalmente **ReceiptExtractionItem**) con campos de consumo (consumption_quantity, consumption_unit, period_start/end, receipt_type, product_normalized, quantity, unit). Los “reportes de consumo” y “reposición” se calculan leyendo estas tablas.
- **Opción B – Tabla de historial:** una tabla **ConsumptionRecord** que se rellena al extraer (o al confirmar) cada recibo: tipo (energy | water | product), quantity, unit, product_name, period, dates, family_id, user_id, transaction_id, receipt_item_id. La extracción con IA alimenta esta tabla; los reportes y la reposición se basan en ella.

Ambas opciones se alimentan **solo de la extracción de datos del recibo (IA)**.

---

## Reposición (cuánto duró la mayonesa, etc.)

Con el historial de compras por producto (extraído de los recibos):

- **Producto** identificado (ej. “Mayonesa” o “Mayonesa 500g”).
- **Fechas de compra** y **cantidad comprada** (ej. 500 g, 1 kg).

Se puede calcular:

- **Duración hasta la siguiente compra:** días entre compra actual y la siguiente del mismo (o similar) producto.
- **Consumo por día (o por semana):** cantidad comprada ÷ días hasta la siguiente compra → “gramos por día” o “kilos por mes”.
- **Reposición:** “la mayonesa de 500 g suele durar ~14 días” o “compras mayonesa cada X días”.

Todo esto se basa en **extracción de datos del recibo (IA)** para saber qué producto, cuántos gramos/kilos/unidades y en qué fecha; el resto es agregar y promediar en el tiempo.

---

## Resumen

| Objetivo | Fuente | Cómo |
|----------|--------|------|
| kWh energía / m³ agua | Extracción IA del recibo de luz/agua | Prompt + campos: consumo (kWh o m³), periodo, tipo de recibo. |
| Historial de consumos | Todos los recibos extraídos | Guardar consumo por recibo (servicios) y por línea (producto + cantidad + unidad). |
| Cuánta mayonesa / qué medicinas | Líneas del ticket (IA) | Extraer cantidad + unidad en cada línea; normalizar producto; filtrar por categoría/usuario. |
| Reposición (duración, consumo/día) | Historial de compras por producto | Fechas y cantidades extraídas → días entre compras, cantidad/día o cantidad/periodo. |

**Todo va a estar basado en la extracción de datos del recibo; la IA es la ayuda para extraer esa información (luz, agua, alimentos en gramos/kilos, medicinas) y así crear el historial de consumos y la reposición.**
