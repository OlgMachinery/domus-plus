# IA en consumos DOMUS: visión y backlog

Documento de visión y backlog para el **motor de análisis y sugerencias** sobre consumos del hogar: precios en super, energía/agua, alertas de incrementos y recomendaciones de compra. La idea inicial (incremento de precios, recomendar qué comprar, anuncios, energía/agua) se amplía con alcance técnico y de producto alcanzable en DOMUS.

---

## 1. Visión en una frase

**DOMUS no solo registra gastos: analiza qué compras y qué pagas por luz/agua, detecta subidas de precios, compara comercios y te sugiere cuándo y dónde comprar mejor.**

---

## 2. Qué tenemos hoy (base de datos y reportes)

- **Recibos extraídos (OCR):** `ReceiptExtraction` con `merchantName`, `receiptDate`, `total`, y para facturas de servicios: `consumptionQuantity`, `consumptionUnit` (kWh, m³), `consumptionPeriodStart/End`.
- **Líneas de ticket:** `ReceiptExtractionItem`: `description`, `quantity`, `unitPrice`, `amount`, `quantityUnit` (g, kg, L, ml, unidades).
- **Reporte de consumo actual** (`/api/reports/consumption`): productos agrupados por nombre normalizado + unidad (con repoción y promedios entre compras); utilidades (luz/agua) por recibo con cantidad y periodo.

Con esto ya se puede:
- Calcular **precio unitario** por producto (por línea: amount/quantity o unitPrice; normalizar producto por nombre+unidad).
- Comparar **mismo producto en el tiempo** (mismo o distinto comercio).
- Analizar **consumo de energía/agua** por periodo (kWh, m³) y por familia.

---

## 3. Ejes del motor de IA en consumos

### 3.1 Precios en super y retail (incrementos y mejores precios)

| Capacidad | Descripción | Fuente de datos |
|-----------|-------------|-----------------|
| **Precio unitario por producto** | Por cada línea de recibo: $/kg, $/L, $/unidad según quantityUnit. Normalizar producto (nombre + unidad) como en consumo. | ReceiptExtractionItem + ReceiptExtraction.merchantName, receiptDate |
| **Histórico de precios** | Serie temporal: producto normalizado → lista de (fecha, comercio, precio unitario, cantidad). | Agregar sobre items + extractions |
| **Detección de incrementos** | “Leche 1L en HEB subió ~X% vs hace 3 meses” (mismo producto, mismo o mismo tipo de comercio). | Histórico + ventana temporal configurable |
| **Comparación entre comercios** | “Leche 1L: promedio este mes HEB $X, Walmart $Y.” | Histórico por merchantName |
| **Recomendación “qué comprar y dónde”** | “Esta semana conviene comprar aceite y arroz en Costco (mejor precio en tu historial).” | Histórico + opcionalmente reglas/heurísticas o IA |
| **Anuncio de incrementos** | Notificación (WhatsApp o app): “DOMUS: detectamos subida de precio en [producto] en [comercio]. Último precio $X → ahora $Y.” | Cron + histórico + umbral de cambio % |

### 3.2 Energía y agua (análisis y sugerencias)

| Capacidad | Descripción | Fuente de datos |
|-----------|-------------|-----------------|
| **Consumo por periodo** | kWh y m³ por periodo de factura (ya existe en consumo). | ReceiptExtraction.consumptionQuantity/Unit/Period |
| **Detección de anomalías** | “Este mes consumiste X% más luz que tu promedio.” | Histórico de consumptionQuantity por tipo (kWh/m³) |
| **Comparación estacional** | “En marzo sueles consumir X kWh; este año Y.” | Histórico por mes/estación |
| **Sugerencias ligeras** | “Tu patrón de consumo de CFE sugiere revisar tarifa DAC” (texto fijo o por reglas simples). | Reglas + promedios |
| **Alertas** | “Factura de luz este mes está por encima de tu promedio.” | Cron + umbral vs media |

### 3.3 Motor de análisis y sugerencias (genérico)

- **Entradas:** histórico de recibos (items + utilidades), parámetros de familia (umbrales, preferencias de notificación).
- **Salidas:**
  - **Sugerencias:** “comprar X en Y”, “revisar consumo de luz”.
  - **Alertas:** “subida de precio en Z”, “consumo de agua alto”.
  - **Resúmenes:** “Resumen de precios y consumos del mes” (WhatsApp o app).

Opcionalmente un **agente de consumos** (chat o WhatsApp): “¿Dónde me conviene comprar leche?” → respuesta basada en histórico de precios por comercio.

---

## 4. Backlog propuesto (por fases)

### Fase D — Datos y API de precios (base)

| Id | Tarea | Alcance | Criterios de aceptación |
|----|--------|---------|--------------------------|
| **D1** | **API de histórico de precios por producto** | Nuevo `GET /api/reports/prices?from=&to=&product= opcional`. Por familia: agrupar items por (producto normalizado, unidad); por cada grupo devolver lista de (fecha, merchantName, unitPrice, quantity, amount). Reutilizar normalizeProductName/normalizeUnit de consumption. | Respuesta con al menos producto, unidad, y serie de precios por comercio/fecha. |
| **D2** | **Precio unitario estable** | En el agregado de D1: cuando quantity y amount están, calcular unitPrice = amount/quantity si falta; cuando hay unitPrice y quantity, amount puede verificarse. Unificar $/L, $/kg, $/unidad según quantityUnit. | Los precios unitarios son consistentes y permiten comparar entre fechas/comercios. |
| **D3** | **Totales de utilidades por periodo** | Endpoint o ampliar consumption: por familia y rango, agregar consumo total kWh y total m³ por periodo (consumptionPeriodStart/End), con fechas y merchantName. | Sirve para detectar anomalías y tendencias de luz/agua. |

### Fase E — Análisis e incrementos

| Id | Tarea | Alcance | Criterios de aceptación |
|----|--------|---------|--------------------------|
| **E1** | **Detección de incremento de precio** | Función (o módulo) que, dado producto normalizado + familia, compare precio reciente (ej. último mes) vs ventana anterior (ej. 2–3 meses). Devuelve % de cambio y “subió/bajó/estable”. | Identificar al menos productos con subida >X% (configurable, ej. 5%). |
| **E2** | **Comparación de precio por comercio** | Dado producto normalizado, devolver promedio o último precio por merchantName en un rango. “En tu historial, leche 1L: HEB $X, Walmart $Y.” | API o función que devuelva precios por comercio para un producto. |
| **E3** | **Anomalía en utilidades** | Dado tipo (kWh o m³) y periodo actual, comparar con media histórica de la familia (ej. últimos 12 meses). Marcar “anómalo” si supera Z% (ej. 30%). | Señalar recibos de luz/agua con consumo inusualmente alto. |

### Fase F — Sugerencias y recomendaciones

| Id | Tarea | Alcance | Criterios de aceptación |
|----|--------|---------|--------------------------|
| **F1** | **Sugerencia “mejor precio por producto”** | Para productos que la familia compra a menudo (ej. top N por frecuencia), sugerir “en tu historial el mejor precio reciente fue en [comercio] con $X (fecha).” | Al menos un endpoint o bloque en reporte que liste 3–5 productos con “mejor comercio” y precio. |
| **F2** | **Recomendación “qué comprar esta semana”** | Heurística o IA: combinar productos de reposición (los que suelen comprarse cada X días) con precios recientes; sugerir “esta semana conviene comprar [lista] en [comercio].” Puede ser reglas simples (productos con buen precio en último mes + próximos a reponer). | Lista corta de sugerencias de compra con comercio y motivo. |
| **F3** | **Resumen mensual de precios y consumos** | Texto o plantilla: “En [mes]: gasto en super $X; productos con subida: [lista]. Luz: Y kWh (Z% vs promedio). Agua: W m³.” Para WhatsApp o panel en app. | Contenido generado a partir de datos reales de la familia. |

### Fase G — Alertas y comunicación

| Id | Tarea | Alcance | Criterios de aceptación |
|----|--------|---------|--------------------------|
| **G1** | **Cron: alertas de incremento de precio** | Cron (ej. semanal) que por familia recorra productos con suficiente historial, aplique E1; si subida > umbral, cree “alerta” o envíe mensaje (WhatsApp al admin o notificación en app). | Al menos un flujo donde una subida detectada genere un aviso (log o mensaje de prueba). |
| **G2** | **Cron: alerta de consumo anómalo (luz/agua)** | Si E3 marca factura reciente como anómala, enviar aviso: “Tu factura de [luz/agua] de [periodo] está por encima de tu promedio.” | Similar a G1 para utilidades. |
| **G3** | **Integración WhatsApp** | Opcional: comando o respuesta del agente “precios” / “resumen consumos” que invoque el resumen F3 y lo envíe por WhatsApp. | Usuario puede pedir por WhatsApp un resumen de precios/consumos. |
| **G4** | **Panel “Precios y consumos” en app** | Vista en domus-beta-dbe (o frontend): pestaña o página que muestre tendencias de precios (productos con subida), mejor precio por producto, consumo luz/agua y anomalías. Consume APIs de D/E/F. | UI que muestre al menos incrementos y mejor precio por producto. |

### Fase H — IA generativa (opcional)

| Id | Tarea | Alcance | Criterios de aceptación |
|----|--------|---------|--------------------------|
| **H1** | **Agente “dónde comprar”** | Pregunta tipo “¿dónde me conviene comprar leche?”: el agente usa E2 + contexto de la familia y responde en lenguaje natural con comercio y precio. | Respuesta coherente con el histórico de precios. |
| **H2** | **Explicación de sugerencias** | Que las sugerencias F1/F2 puedan tener una frase en lenguaje natural (IA) que explique por qué se recomienda ese comercio o ese producto. | Texto corto y comprensible por familia. |

---

## 5. Orden sugerido de implementación

1. **D1, D2, D3** — Tener datos de precios y utilidades bien expuestos.
2. **E1, E2, E3** — Análisis (incrementos, por comercio, anomalías).
3. **F1, F2, F3** — Sugerencias y resumen.
4. **G1, G2** — Crons de alertas (precios y utilidades).
5. **G3, G4** — Comunicación (WhatsApp + panel).
6. **H1, H2** — Si hay recursos, capa de IA conversacional y explicaciones.

---

## 6. Consideraciones técnicas

- **Normalización:** Reutilizar y extender `normalizeProductName` y `normalizeUnit` de `reports/consumption` para que precios y consumo compartan la misma noción de “producto”.
- **Rendimiento:** Histórico de precios puede ser pesado; considerar ventanas (ej. últimos 12 meses) y agregados por producto/comercio/mes.
- **Privacidad:** Todo por familia; no cruzar datos entre familias.
- **Configuración:** Umbrales (ej. “subida > 5%”, “anomalía > 30%”) en env o tabla de configuración por familia (futuro).

---

## 7. Resumen de valor para la familia

- **Saber:** “¿Subieron los precios de lo que compro?” → sí, con datos propios.
- **Ahorrar:** “¿Dónde comprar X más barato?” → recomendación basada en su historial.
- **Anticipar:** “¿Qué comprar esta semana?” → sugerencias por repoción y precio.
- **Controlar:** “¿Mi luz/agua está normal?” → alertas de consumo anómalo.
- **Resumen:** Un solo mensaje o pantalla con precios, consumos y avisos.

Este documento sirve como visión y backlog; las tareas D1–G4 son implementables sobre la base actual de DOMUS sin cambios de esquema grandes (solo uso más rico de ReceiptExtraction + ReceiptExtractionItem y consumption). Las fases H son opcionales y dan el salto a “motor de análisis y sugerencias” con lenguaje natural.
