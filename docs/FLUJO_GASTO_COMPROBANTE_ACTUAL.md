# Flujo actual: Gasto con comprobante (modal wizard)

**Ubicación:** `domus-beta-dbe/src/app/ui/page.tsx` (sección Transacciones), modal `txReceiptWizardOpen`.

## Pasos actuales

1. **Paso 1 – Captura**
   - A. Monto (opcional)
   - B. Categoría (opcional; select "Cuenta → Categoría" = allocationId)
   - C. Fotos (1–8), obligatorio
   - Acciones: **Registrar otro gasto** | **Asignar**

2. **Paso 2 – Asignar a quién**
   - Tabs: **Yo** | **Otros usuarios**
   - **Yo:** select "Mi cuenta / categoría" (solo allocations de mi persona).
   - **Otros usuarios:** mensaje "Próximamente"; no hay lista de usuarios aún.
   - Botones: Atrás | Guardar

## Comportamiento

- **Registrar otro gasto:** POST `/api/transactions/from-receipt`, no espera extracción (`awaitExtraction: false`), limpia monto/allocation/files y deja el wizard abierto.
- **Asignar:** pasa al paso 2; si el usuario elige "Yo" y una categoría, Guardar hace el mismo POST y cierra el wizard.
- **Extracción:** se lanza en segundo plano tras crear transacción/recibo; no bloquea la UI.

## Pendiente (TODO)

- En "Otros usuarios": mostrar lista de usuarios (Admin = todos, usuario = otros) y luego flujo enviar → aceptar/rechazar.
- Modal más intuitivo en móvil (bottom sheet, botones más claros).
- Auto-categoría desde extracción cuando esté disponible.
