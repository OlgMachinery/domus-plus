# Mejoras UI y flujo — sugerencias y todo list (marzo 2026)

## Sugerencias antes de implementar

1. **Prioridad flujo vs visual**
   - Corregir primero el flujo de **confirmar comprobante** (avanzar al siguiente / cerrar panel) para que no quede en “pendiente”; luego pills, filtros y calendario.

2. **Pills y botones**
   - Reducir tamaño de pills en tablas (Por confirmar, Confirmado, Solicitud efectivo, Pendiente) y en calendario; mantener legibilidad en móvil.

3. **Calendario en móvil**
   - Opciones: (a) vista “Lista” por defecto en viewport estrecho, (b) celdas más grandes y menos eventos por día, (c) toque en día abre lista del día en lugar de minicalendario.

4. **Filtros**
   - Unificar ancho y altura de los controles (selects e inputs) en una fila; usar CSS grid o flex con `min-width` igual para todos.

5. **Solicitudes**
   - Dejar la vista “Solicitudes” solo para solicitudes de efectivo/pago (no mezclar con “por confirmar” de transacciones); en web ya está separado; en móvil asegurar títulos y textos.

6. **Usuarios (revisar/crear)**
   - Diseño tipo iPhone: formulario “Agregar usuario” en card compacta; lista de usuarios en filas con avatar, nombre, email y acciones secundarias; botones de acción con tamaño estándar (no full-width gigante).

7. **Partidas**
   - Mostrar lista completa de partidas; etiquetas solo en español (Persona, Casa, Mascota, etc.); botón “Menú” o cierre de modal a la **izquierda** en todos los modales.

8. **Flujo confirmar comprobante**
   - Tras “Asignar y confirmar”, refrescar lista, cerrar detalle o abrir el siguiente pendiente; si no hay más, cerrar panel y volver a la lista para que no quede en “pendiente”.

---

## Todo list (orden sugerido)

| # | Tarea | Estado |
|---|--------|--------|
| 1 | **Flujo confirmar comprobante:** Tras confirmar, cerrar panel o abrir siguiente; asegurar que el estado “Confirmado” se refleje y no vuelva a “Pendiente”. | Pendiente |
| 2 | **Pills más pequeños:** Ajustar `.table .pill` y pills en columna Comprobante / Notas (tamaño de fuente y padding) para que no se vean “muy grandes”. | Pendiente |
| 3 | **Filtros simétricos:** Transacciones (y Reportes si aplica): mismos anchos/alturas para Rango, Desde, Hasta, Comprobante, Categoría, Partida, Usuario, Buscar. | Pendiente |
| 4 | **Solicitudes:** Revisar que en web y móvil solo se muestre contenido de “Solicitudes de efectivo/pago”; quitar textos que sugieran “aprobar” genérico. | Pendiente |
| 5 | **Calendario móvil:** Rediseño o ajuste para que sea legible en cel (vista lista por defecto o celdas más grandes / menos densidad). | Pendiente |
| 6 | **Usuarios diseño iPhone:** Formulario y lista de usuarios más compactos y claros; botones proporcionados. | Pendiente |
| 7 | **Partidas:** Lista completa en español; botón Menú/cierre de modal a la izquierda en modales de partidas y consistente en toda la app. | Pendiente |

---

## Notas técnicas

- **Confirmación de recibo:** La API `POST /api/receipts/[id]/confirm` ya actualiza `confirmedAt`. El deliver de solicitudes ya crea `ReceiptExtraction`. Si el usuario sigue viendo “Pendiente”, puede ser que tras confirmar no se cierre el panel o no se refresque la lista/estado; conviene cerrar el detalle (`setSelectedTxId(null)`) al volver a la lista.
- **Pills:** En `components.css` ya existe `.table .pill { font-size: 0.6875rem; padding: 3px 6px; }`; revisar si hay otras reglas que los agranden (p. ej. en dashboard o calendario).
- **Vista Solicitudes (web):** Es la vista `solicitudes` en `page.tsx`; no debe mostrar “por confirmar” de transacciones (eso va en Transacciones).
