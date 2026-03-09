# Calendario unificado DOMUS: todo lo calendarizable + impresión

## Objetivo

Un **único calendario** que concentre todo lo que tiene fecha en DOMUS (pagos, presupuesto, solicitudes, facturas, pendientes) y que se pueda **imprimir** para tenerlo en papel o PDF.

---

## Qué es “calendarizable” en DOMUS

| Tipo | Origen | Qué se muestra | Frecuencia |
|------|--------|----------------|------------|
| **Pago realizado** | Transaction | Gasto registrado (fecha, monto,  deploydescripción) | Por transacción |
| **Pago esperado (IA)** | Motor recurrencias | “Próximo pago estimado” (renta, CFE, etc.) | Mensual |
| **Día de corte** | Family.cutoffDay | “Cierre de periodo presupuestal” | Cada mes (día fijo) |
| **Solicitud de efectivo** | MoneyRequest | “Solicitud pendiente” / “Entrega de efectivo” | requestedAt / deliveredAt |
| **Factura luz/agua** | ReceiptExtraction (utility) | “Factura CFE/agua” (periodo o vencimiento estimado) | Por recibo / periodo |
| **Recibo por confirmar** | ReceiptExtraction.confirmedAt null | “Confirmar clasificación de recibo” | Cuando hay pendientes |
| **Sugerencia presupuesto** | BudgetAdjustmentSuggestion PENDING | “Revisar sugerencia de presupuesto” | Cuando hay pendientes |

Con esto el calendario deja de ser solo “pagos” y pasa a ser **agenda de la familia**: dinero, presupuesto y tareas con fecha.

---

## Productos propuestos

### 1. API unificada

- **`GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD`** (o ampliar la actual de payments):
  - **events**: lista unificada de eventos con `type`, `date`, `label`, `amount` (si aplica), `id`/`meta` para enlace.
  - Tipos: `payment` | `payment_expected` | `cutoff` | `money_request` | `money_delivered` | `utility_reminder` | `receipt_pending_confirm` | `budget_suggestion`.
  - Opcional: mantener también `paid`, `upcoming`, `recurring` para compatibilidad o vistas específicas.

### 2. Vista única en la app

- Una sola pantalla **Calendario** (mes/semana) que muestre:
  - Todos los eventos en el rango, agrupados por día o en lista ordenada.
  - Leyenda por tipo (color o icono): pago, esperado, corte, solicitud, factura, pendientes.
  - Navegación por mes (ya existente).
- Filtros opcionales: “solo pagos”, “solo pendientes”, “todo”.

### 3. Impresión

- **Botón “Imprimir calendario”** en la vista:
  - Prepara una vista **solo de calendario** (oculta menú, sidebar, botones de acción).
  - Usa **CSS `@media print`** para:
    - Página en blanco, márgenes y título “Calendario DOMUS – [mes/año]”.
    - Lista de eventos por día o tabla mes/día.
  - Acción: **`window.print()`** (el usuario elige impresora o “Guardar como PDF”).
- Opcional: ruta `/ui/calendario/print?month=YYYY-MM` que renderice solo el contenido imprimible (útil para “Abrir en nueva pestaña → Imprimir”).

---

## Criterios de aceptación

- [ ] El calendario muestra al menos: pagos realizados, pagos esperados (IA), día de corte y solicitudes de efectivo (fecha de solicitud o entrega).
- [ ] Existe botón “Imprimir” que abre el diálogo de impresión con una vista limpia (sin navegación de la app).
- [ ] La impresión incluye mes/año, nombre de familia (si se desea) y lista o grilla de eventos por fecha.
- [ ] Opcional: eventos de facturas (luz/agua) y de “recibo por confirmar” cuando haya datos.

---

## Orden sugerido

1. Ampliar API de calendario con eventos de corte, solicitudes y (opcional) utilidades.
2. Unificar la vista Calendario en la app para consumir la lista de eventos y mostrar todos los tipos.
3. Añadir botón Imprimir y estilos `@media print` para la sección del calendario.
4. (Opcional) Ruta o modo “solo imprimible” para abrir en nueva pestaña e imprimir.

---

## Implementación (Time Engine)

- **API:** `GET /api/calendar/events?from=&to=` — contrato en **docs/TIME_ENGINE_API.md**.
- **UI:** Vista Calendario en domus-beta-dbe consume esta API, panel resumen, colores por tipo y enlace al registro (transacción o solicitud).

---

## Uso del calendario para temas no financieros

El mismo calendario **sí puede usarse para temas no financieros** (cumpleaños, citas, recordatorios, vacaciones, etc.). La arquitectura ya es genérica:

- **API:** Devuelve una lista de eventos con `type`, `title`, `date`, `source_table`, `source_id`. No exige que sean solo pagos.
- **Time Engine:** Hoy agrega solo fuentes financieras; se puede **ampliar** añadiendo nuevas fuentes (tabla de eventos de familia, integraciones, etc.) que generen eventos con tipos nuevos.
- **UI (FullCalendar):** Muestra cualquier evento; los colores e iconos se definen por `type` en CSS. Basta añadir tipos nuevos (p. ej. `birthday`, `appointment`, `reminder`) y sus estilos.

### Cómo extenderlo a no financiero

1. **Nuevas fuentes de datos**  
   - Opción A: tabla `family_calendar_event` (o similar) con campos: familia, título, fecha, tipo, opcional enlace a entidad/partida.  
   - Opción B: reutilizar entidades existentes (p. ej. “cumpleaños” en perfiles de usuario o entidades) y que el time-engine las convierta en eventos de calendario.

2. **Time Engine**  
   - En `getCalendarEvents()`, además de transacciones, solicitudes, etc., consultar la nueva fuente y añadir eventos con un `type` nuevo (p. ej. `birthday`, `appointment`, `reminder`, `vacation`).

3. **API**  
   - Sin cambios: la misma `GET /api/calendar/events` devuelve la lista unificada (financiera + no financiera). Opcional: parámetro `topic=all|finance|family` para filtrar por tipo.

4. **UI**  
   - En `DomusCalendar` / `eventClassNames`: mapear los nuevos tipos a clases CSS (p. ej. `fc-event-birthday`, `fc-event-appointment`).  
   - En `calendar-fullcalendar.css`: definir color e icono para cada tipo nuevo.

Con esto, el calendario pasa a ser **una sola agenda**: finanzas + lo que la familia quiera calendarizar (eventos, recordatorios, fechas importantes), sin tener que montar un segundo calendario.

### Implementado (eventos no financieros)

- **Modelo:** `FamilyCalendarEvent` (familyId, title, eventDate, type, description). Tipos: `birthday`, `appointment`, `reminder`, `vacation`, `custom`.
- **Time Engine:** Incluye estos eventos en `getCalendarEvents()`; se muestran en el mismo calendario con color e icono por tipo.
- **API:** `POST /api/calendar/family-events` (crear), `DELETE /api/calendar/family-events/[id]` (eliminar).
- **UI:** Botón "Añadir evento" en la vista Calendario; modal con título, fecha y tipo. Al hacer clic en un evento familiar, confirmación para eliminarlo.

### Cal.com (opcional, para después)

Si más adelante quieren **reservar citas** (ej. con el contador, o entre miembros), se puede integrar **Cal.com** como complemento: embed en una página "Reservar cita" o sincronizar sus eventos con nuestra API. No sustituye el calendario unificado; sería una función adicional de agendamiento con disponibilidad.
