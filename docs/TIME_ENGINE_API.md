# DOMUS Time Engine — Contrato de API

## Principio

El **Time Engine** es el agregador temporal del sistema: unifica en una sola línea de tiempo todos los eventos con fecha (pagos, corte, solicitudes, facturas, etc.). Cada evento incluye referencia al objeto de origen (`source_table`, `source_id`) para que la UI pueda navegar al detalle.

## Endpoint

```
GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
```

- **from**, **to**: rango de fechas (inclusive). Opcionales; por defecto mes actual.
- Requiere sesión (familia activa).

## Respuesta

```json
{
  "ok": true,
  "from": "2026-04-01",
  "to": "2026-04-30",
  "familyName": "Familia Pérez",
  "cutoffDay": 1,
  "events": [
    {
      "id": "evt_tx_abc123",
      "type": "payment",
      "title": "Pago tarjeta Visa",
      "date": "2026-04-15",
      "amount": 3200,
      "status": "completed",
      "source_table": "transaction",
      "source_id": "abc123"
    },
    {
      "id": "evt_cutoff_2026-04-01",
      "type": "cutoff",
      "title": "Cierre presupuestal",
      "date": "2026-04-01",
      "status": "scheduled",
      "source_table": "family",
      "source_id": null
    }
  ],
  "summary": {
    "totalEvents": 14,
    "paymentsPending": 6,
    "paymentsCompleted": 4,
    "totalCommitted": 8450
  }
}
```

## Tipos de evento

| type                | Descripción                    | source_table        | source_id   |
|---------------------|--------------------------------|---------------------|-------------|
| payment             | Gasto registrado               | transaction         | id transacción |
| payment_expected    | Pago esperado (IA/recurrencia) | recurring_inferred  | id recurrencia |
| cutoff              | Día de cierre presupuestal     | family              | null        |
| money_request       | Solicitud de efectivo         | money_request       | id solicitud |
| money_delivered     | Entrega de efectivo           | money_request       | id solicitud |
| utility_reminder    | Factura luz/agua (periodo)    | receipt_extraction  | receiptId   |

## Navegación desde la UI

- `source_table === 'transaction'` y `source_id` → abrir detalle de transacción (ej. `openTx(source_id)`).
- `source_table === 'money_request'` → ir a Solicitudes y resaltar esa solicitud.
- `source_table === 'receipt_extraction'` / receipt → abrir recibo o transacción asociada.
- `source_table === 'family'` o `source_id === null` → sin enlace (solo informativo).

## Resumen (summary)

- **totalEvents**: cantidad de eventos en el rango.
- **paymentsPending**: eventos de tipo payment_expected + money_request con status PENDING.
- **paymentsCompleted**: eventos payment con status completed.
- **totalCommitted**: suma de `amount` de todos los eventos de pago (realizados + esperados) en el rango.

## Compatibilidad

- La ruta **GET /api/calendar/payments** sigue disponible y devuelve `paid`, `upcoming`, `recurring`, `events` (formato anterior) para no romper integraciones. La UI del calendario puede migrar a **GET /api/calendar/events** y usar `events` + `summary`.
