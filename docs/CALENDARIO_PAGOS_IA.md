# Calendario de pagos con motor IA

## Visión

**DOMUS detecta qué pagas cada mes (renta, CFE, Netflix, etc.), predice cuándo vence el siguiente y te muestra un calendario de pagos reales y esperados.**

## Fuentes de datos

- **Transacciones** (`Transaction`): fecha, monto, descripción, partida (allocation → categoría/entidad). Sin tabla de “pagos recurrentes” explícita: el motor **infiere** patrones del historial.
- Opcional: **Recibos de utilidades** con `consumptionPeriodStart/End` para afinar “próximo vencimiento” de luz/agua.

## Motor IA (detección de recurrentes)

1. **Agrupar** transacciones por “clave” de recurrencia: descripción normalizada + partida (o solo descripción si se prefiere).
2. **Filtrar** grupos con al menos 3 ocurrencias en los últimos 12–24 meses.
3. **Calcular** por grupo:
   - Intervalo mediano entre fechas (días).
   - Día del mes más frecuente (o mediana).
   - Monto mediano (o promedio).
4. **Clasificar** intervalo: ~mensual (25–35 días), ~bimestral (55–65), etc.
5. **Predecir** “próxima fecha esperada”: último pago + intervalo, o día N del mes siguiente.
6. **Opcional (IA generativa):** LLM que, dada la descripción, devuelva un nombre corto (“Renta”, “Luz CFE”, “Netflix”).

## Productos

- **API** `GET /api/calendar/payments?from=YYYY-MM-DD&to=YYYY-MM-DD`: devuelve:
  - `paid`: transacciones ya registradas en el rango.
  - `upcoming`: pagos esperados (inferidos) que aún no tienen transacción en ese mes.
- **Vista Calendario** en la app: mes actual (o navegable) con:
  - Días con pagos realizados (con monto y etiqueta).
  - Días con “pago esperado” (inferido) y monto sugerido.
- **Lista “Próximos pagos”** en dashboard: siguientes 5–7 días con esperados + recordatorio si falta un recurrente del mes.

## Criterios de aceptación

- Al menos 2–3 gastos recurrentes detectados automáticamente (ej. renta, CFE) cuando hay historial.
- El calendario muestra el mes actual con pagos reales y esperados.
- La API sirve tanto para la vista calendario como para widgets/WhatsApp futuros.

---

## Ampliación: calendario unificado e impresión

Ver **`docs/CALENDARIO_UNIFICADO_PROPUESTA.md`** para la propuesta de “todo lo calendarizable” e impresión.

**Implementado:**
- **Eventos unificados:** la API devuelve `events` con tipo: `payment`, `payment_expected`, `cutoff` (día de corte presupuestal), `money_request`, `money_delivered`, `utility_reminder` (factura luz/agua por periodo).
- **Vista:** sección “Todos los eventos del mes” con fecha, tipo y etiqueta; leyenda por tipo (Pago, Esperado IA, Corte presupuesto, Solicitud, Entrega, Factura).
- **Imprimir:** botón “Imprimir” que abre el diálogo de impresión; estilos `@media print` dejan solo el bloque del calendario visible (sin menú ni sidebar), con título “Calendario DOMUS — [Familia] — [Mes año]”.
