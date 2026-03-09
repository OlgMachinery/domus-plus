# Flujo actual: Registrar gasto con comprobante

**Ubicación:** `domus-beta-dbe/src/app/ui/page.tsx`, vista Transacciones.

## Estado actual (antes del rediseño)

- **No hay modal:** el formulario es inline en la página Transacciones.
- **Tabs:** "Con comprobante" | "Sin comprobante".
- **Con comprobante – orden actual:**
  1. **Fotos (1–8)** – input file, obligatorio.
  2. **Cuenta (opcional)** – select con "Auto (recomendado)" o lista de asignaciones "Entidad → Categoría (límite $X)".
  3. Botón **"Registrar gasto con comprobante"**.
- **Al enviar:** `createTransactionFromReceipt()` → POST `/api/transactions/from-receipt` (files + optional allocationId) → éxito → `openTx(transactionId)`, `setTxTab('Evidencias')`, **await** `extractReceipt(receiptId)`.
- **Bloqueo:** la extracción se espera en el cliente; el usuario es llevado al detalle del gasto y ve el proceso de extracción.
- **Sin comprobante:** Cuenta/asignación, Monto, Fecha, Descripción; botón "Registrar gasto".

## Cambios a implementar

- Modal dedicado para "Con comprobante" (más intuitivo y responsivo).
- Orden: **A. Gasto** (monto opcional) → **B. Categoría** (opcional) → **C. Foto** (obligatorio) → **1. Registrar otro gasto** | **2. Asignar**.
- Paso **Asignar** = "A quién": **Yo** (mis categorías/asignaciones) | **Otros usuarios** (lista; Admin ve todos).
- "Registrar otro gasto": enviar sin esperar extracción; extracción en background; no abrir detalle.
- Modal adaptable a móvil (altura útil, botones grandes).
