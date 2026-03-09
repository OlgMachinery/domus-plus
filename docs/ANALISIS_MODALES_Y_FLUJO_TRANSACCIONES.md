# Análisis: modales y flujo (detalle de transacción y otros)

Revisión lógica para evitar "callejones sin salida" y mejorar uso del espacio, antes de implementar cambios.

---

## 1. Vista «Detalle de transacción» (view === 'tx')

**Qué es:** No es un modal flotante; es una **vista de página completa** que reemplaza el contenido cuando se abre una transacción desde la lista (click en fila → `openTx(id)` → `setView('tx')`).

### Problemas detectados

| Problema | Detalle |
|----------|---------|
| **Sin forma explícita de cerrar** | No hay botón "Cerrar", "Volver" ni "← Transacciones". Para salir el usuario debe usar el menú lateral (Transacciones). En móvil el sidebar está oculto; solo queda abrir el menú hamburguesa y tocar "Transacciones". Sensación de callejón sin salida. |
| **Sin Anterior / Siguiente** | No hay forma de pasar a la transacción anterior o siguiente sin cerrar y volver a abrir otra desde la lista. El flujo "revisar varias transacciones" es lento y poco intuitivo. |
| **Muy largo y espacios vacíos** | Contenido en una sola columna con muchos `spacer8`/`spacer12` y bloques (Detalle, Ajustar vista, Campos financieros, Asignar y confirmar, Auditoría, Ticket y tabla). En móvil se alarga mucho el scroll. |
| **"Ajustar vista"** | El control deslizante tiene sentido en desktop (dos paneles), pero en móvil la cuadrícula de dos columnas no aporta y ocupa espacio y atención sin beneficio claro. |
| **Duplicación de contexto** | Título "Entidad — Categoría" y debajo otra vez los mismos datos en "Detalle (campos financieros)". Se puede compactar. |

### Lógica actual (resumen)

- **Entrada:** Click en fila de Transacciones → `openTx(id)` → `setView('tx')`, `setSelectedTxId(id)`.
- **Salida:** Solo cambiando de vista (sidebar o menú móvil) → no hay salida desde dentro del detalle.
- **Siguiente transacción:** Solo existe después de "Asignar y confirmar" (abre la siguiente por confirmar); no hay "Siguiente" genérico.

### Sugerencias (antes de codear)

1. **Botón Cerrar / Volver** en la parte superior del detalle (siempre visible): "← Volver" o "Cerrar" que ejecute `setSelectedTxId(null); go('transacciones')`.
2. **Anterior / Siguiente:** En la cabecera del detalle, botones "← Anterior" y "Siguiente →" que muevan sobre `txFilteredItems` (índice actual ± 1) y llamen a `openTx(prevId)` / `openTx(nextId)`. Deshabilitar cuando no haya anterior/siguiente.
3. **Compactar en móvil:** En viewport estrecho: ocultar o colapsar "Ajustar vista"; agrupar campos en menos bloques; reducir espaciado vertical; opcionalmente mostrar Detalle y Evidencias en pestañas más compactas.
4. **Un solo título:** Evitar repetir entidad/categoría en título y en "Detalle (campos financieros)"; un bloque de datos financieros bien agrupado basta.

---

## 2. Modal «Solicitud de efectivo»

**Qué es:** Modal flotante para crear una solicitud de efectivo (motivo, monto, partida).

### Revisión

| Aspecto | Estado |
|---------|--------|
| **Cerrar** | Tiene botón "Cerrar" y cierre al hacer click en el overlay. Lógica correcta. |
| **Salida tras éxito** | Tras enviar, se muestra "Solicitud enviada" y el usuario puede cerrar con el botón. Fluido. |
| **Espacio** | Modal `modalPanelSm`; contenido razonable. Sin problema de callejón sin salida. |

### Sugerencia

- Sin cambios obligatorios. Opcional: tras "Solicitud enviada", cerrar automáticamente a los 2 s o ofrecer "Cerrar y ver solicitudes".

---

## 3. Modal / overlay «Reportes»

**Qué es:** Panel grande (createPortal) con pestañas Detalle, Resumen, Tablas, Consumo.

### Revisión

| Aspecto | Estado |
|---------|--------|
| **Cerrar** | Click en overlay → `setReportsOpen(false)`. No hay botón "Cerrar" visible en la barra; el botón "Menú" abre el menú, no cierra Reportes. En móvil puede no ser obvio que hay que tocar fuera. |
| **Salida** | Depende de que el usuario sepa que puede cerrar tocando fuera. No es un callejón sin salida pero no es muy explícito. |

### Sugerencias

- Añadir en la cabecera un botón "Cerrar" o "×" que haga `setReportsOpen(false)`.
- Mantener el cierre por click en overlay.

---

## 4. Modal «Eliminar familia» (deleteFamilyOpen)

**Qué es:** Confirmación para eliminar la familia.

### Revisión

- Suele tener "Cancelar" y "Eliminar". Revisar que siempre haya "Cancelar" que cierre el modal sin eliminar. Sin más contexto en el código, se asume que la lógica es correcta.

---

## 5. Modal / wizard «Subir comprobante» (txReceiptWizardOpen)

**Qué es:** Flujo para subir recibos y asociarlos a transacciones.

### Revisión

- Debe tener "Cerrar" o "Cancelar" en cada paso para no encerrar al usuario. Comprobar que exista y que cierre el wizard por completo (no solo un paso).

---

## 6. Vista detalle «Solicitudes» (selectedMoneyRequestId)

**Qué es:** Al hacer click en una fila de la tabla de Solicitudes se muestra un bloque debajo con detalle y acciones (Aprobar, Rechazar, Registrar entrega).

### Revisión

| Aspecto | Estado |
|---------|--------|
| **Cerrar** | Hay botón "Cerrar detalle" que hace `setSelectedMoneyRequestId(null)`. Correcto. |
| **Siguiente** | No hay "Siguiente solicitud" / "Anterior". Opcional para flujo de aprobaciones masivas. |

### Sugerencia

- Mantener como está. Opcional: añadir "Anterior" / "Siguiente" entre solicitudes filtradas.

---

## 7. Modal «Evento de calendario» (calendarEventModalOpen)

**Qué es:** Crear/editar evento del calendario.

### Revisión

- Debe tener "Cancelar" y "Guardar" (o similar). Verificar que "Cancelar" cierre el modal sin guardar.

---

## 8. Modal «Presupuesto» (budgetModalOpen)

**Qué es:** Panel con pestañas (cuentas, objetos, categorías, montos).

### Revisión

- Existe `closeBudgetModal()`. Verificar que en la UI haya un botón o acción visible que llame a esa función (por ejemplo "Cerrar" o "×" en la cabecera).

---

## 9. Otros overlays

- **Menú móvil (mobileNavOpen):** Se cierra al elegir una opción o al hacer click fuera. Correcto.
- **Menús desplegables (familia, reportes):** Se cierran al elegir o al click fuera. Correcto.

---

## Resumen de prioridades (recomendado)

| Prioridad | Qué hacer |
|-----------|------------|
| **Alta** | Detalle de transacción: botón **Cerrar / Volver** siempre visible y, si es posible, **Anterior / Siguiente** sobre la lista filtrada. |
| **Alta** | Detalle de transacción: **compactar** en móvil (menos espaciado, ocultar o simplificar "Ajustar vista", evitar bloques redundantes). |
| **Media** | Reportes: botón **Cerrar** explícito en la cabecera. |
| **Media** | Revisar wizard de comprobantes y modal de evento de calendario para asegurar **Cancelar/Cerrar** visible. |
| **Baja** | Solicitudes: opcional Anterior/Siguiente. Modal solicitud efectivo: cierre automático opcional tras éxito. |

---

## Flujo deseado (principio rector)

- **Cada pantalla o modal que “abre” algo** debe tener una salida clara: botón Cerrar / Volver / Cancelar o gesto equivalente.
- **Listas con detalle** (transacciones, solicitudes): además de cerrar, conviene poder avanzar a **siguiente / anterior** sin cerrar y volver a la lista.
- **Uso del espacio:** en móvil, priorizar contenido útil y reducir espaciado y bloques repetidos para evitar scroll excesivo.

Cuando decidas qué puntos implementar primero, se puede bajar a cambios concretos en `page.tsx` y estilos (clases, media queries) sin tocar la lógica de negocio.

---

## 10. Flujo «Nuevo gasto con comprobante» (wizard + «Asignar a quién»)

**Qué es:** Modal/wizard en dos pasos: (1) Captura: monto opcional, categoría opcional, fotos (Cámara/Seleccionar), luego "Registrar otro gasto" o "Asignar"; (2) Asignar a quién: Yo / Otros usuarios, selector de categoría o usuario, Guardar.

### Problemas detectados (flujo e intuición)

| Problema | Detalle |
|----------|---------|
| **Modal “a la mitad” en móvil** | En viewport ≤480px el panel usa `align-items: flex-end` y `min-height: 70dvh`, por lo que se ve como bottom sheet y la mitad superior queda vacía. Da sensación de “mucho espacio sin aprovechar” y de pantalla “baja”. |
| **Botones Cámara / Seleccionar “muertos”** | Usan `btn btnGhost btnSm`: gris, sin icono. No destacan como acciones principales; en móvil se esperaría un botón tipo iPhone (icono de cámara, más vivo). |
| **Callejón sin salida “Sin partidas propias”** | En paso 2, pestaña “Yo”, el desplegable “Mi cuenta / categoría” solo muestra **partidas propias** (`receiptWizardAllocationsForMe` = entidad tipo PERSON que coincida con el usuario). Si no hay partida con tu nombre o no tienes asignada ninguna categoría para “ti”, la lista está vacía y solo se muestra la opción deshabilitada: *“Sin partidas propias; usa Cuenta (opcional) en el paso anterior.”* El usuario no sabe **dónde** crear esas partidas (Presupuesto) ni tiene un enlace/acción clara; “paso anterior” implica volver y elegir en el paso 1, pero en paso 1 “B. Categoría” sí muestra **todas** las partidas (Casa, Auto, etc.). Hay incoherencia: en paso 2 “Yo” no se ofrecen las mismas opciones que en paso 1. |
| **Flujo poco intuitivo** | Quien sube una foto y pulsa “Asignar” llega a “Asignar a quién”. Si elige “Yo” y no tiene partidas propias, solo ve el mensaje de “sin partidas” sin saber si debe ir a Presupuesto, volver atrás o hacer otra cosa. Falta una salida clara: “Ir a Presupuesto a crear partidas” o ofrecer en “Yo” también la lista completa de partidas (como en paso 1). |
| **Texto muy largo** | Las instrucciones del paso 1 (los 3 pasos + tip de fotos) ocupan mucho y hacen el modal largo; en móvil se podría acortar o colapsar. |

### Lógica actual (resumen)

- **Paso 1 (capture):** `allocations` = todas las partidas; el usuario puede elegir “Asignar después” o cualquier partida (Casa → X, etc.).
- **Paso 2 (assign):** “Yo” → solo `receiptWizardAllocationsForMe` (partidas cuya entidad es “mi” persona). Si no hay entidad PERSON asociada al usuario o no hay asignaciones para ella, la lista está vacía → mensaje “Sin partidas propias…”.
- **Posicionamiento:** En móvil, `.txReceiptWizardOverlay` y `.receiptWizardPanel` están pensados como bottom sheet (pegado abajo, no centrado verticalmente), de ahí la “mitad” vacía arriba.

### Sugerencias (flujo y UI)

1. **Modal en móvil:** Opción A: hacer el wizard a altura casi completa (p. ej. `min-height: 88dvh` o `95dvh`) para aprovechar la pantalla y reducir la sensación de “mitad vacía”. Opción B: mantener bottom sheet pero con un “handle” y título más compacto para que el contenido útil gane espacio.
2. **Botones Cámara y Seleccionar:** Darles clase propia (p. ej. `receiptWizardPhotoBtn`) con estilo más “vivo”: color primario o fondo con borde, icono de cámara (SVG o emoji 📷) en “Cámara” e icono de galería/carpeta en “Seleccionar”, tamaño táctil generoso. Evitar que se confundan con botones secundarios grises.
3. **“Sin partidas propias” – evitar callejón sin salida:**  
   - **Opción recomendada:** En paso 2, pestaña “Yo”, si `receiptWizardAllocationsForMe.length === 0`, mostrar **la misma lista que en paso 1** (`allocations`) en el desplegable “Mi cuenta / categoría” (o renombrar a “Cuenta / categoría”), con una nota: “No hay partida con tu nombre; aquí puedes asignar a Casa, Auto, etc.” Así el usuario siempre puede elegir algo y guardar.  
   - **Además (o en su lugar):** Debajo del desplegable, si la lista está vacía, añadir un enlace o botón: “Crear o editar partidas en Presupuesto” que ejecute `setTxReceiptWizardOpen(false)` (o deje el wizard abierto en segundo plano) y `setBudgetModalOpen(true)`, para que sepa **dónde** ir a crear partidas.
4. **Instrucciones paso 1:** Reducir o colapsar el bloque de los 3 pasos + tip en móvil (por ejemplo, un `<details>` “Cómo funciona” o un texto más corto) para acortar el modal y dar más protagonismo a Monto, Categoría y Fotos.
5. **Paso 2:** Dejar claro que “Atrás” vuelve al paso 1 (ya está) y que “Guardar” cierra el wizard y deja el gasto en Transacciones; opcionalmente un toast “Gasto guardado en Transacciones” al cerrar.
