# Análisis: modales, botones y experiencia iPhone (DOMUS)

Resumen del análisis detallado y de los cambios aplicados para pulir modales, botones y uso en iPhone sin romper funcionalidad.

---

## 1. Modales identificados

| Modal | Estado | Se abre con | Cierre |
|-------|--------|-------------|--------|
| **Eliminar familia** | `deleteFamilyOpen` | Botón "Eliminar familia" en Configuración | Cerrar, Cancelar, "Descargar respaldo y eliminar" |
| **Reportes** | `reportsOpen` | Navegación → Reportes | Cerrar (unificado) |
| **Presupuesto (studio)** | `budgetModalOpen` | "Crear/Editar presupuesto", clic en filas | Cerrar (unificado, 1 en toolbar) |
| **Responsables** | `entityOwnersOpen` | Botón "Responsables" en Partidas del modal Presupuesto | Cerrar, Cancelar, Guardar |
| **Integrantes (presupuesto individual)** | `peopleBudgetOpen` | Botón "Integrantes" en Presupuesto | Cerrar (unificado) |

---

## 2. Cambios aplicados

### Modales
- **Botón Cerrar unificado:** Todos los "Cerrar" de modales usan `btnGhost btnSm` (antes algunos usaban `btnDanger`). Misma apariencia en Eliminar familia, Reportes, Presupuesto, Responsables, Integrantes.
- **Eliminado Cerrar duplicado** en el modal Eliminar familia (quedó un solo Cerrar en la esquina).
- **Accesibilidad:** En "Eliminar familia": `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-delete-family-title"` en el panel; `aria-label="Cerrar"` en todos los botones Cerrar de modales.

### iPhone / móvil
- **Safe area:** Header usa `env(safe-area-inset-top)`, `env(safe-area-inset-left/right)` en el padding. Contenido (`sapContent`) y modales usan safe-area en bottom y laterales. Menú móvil (`mobileNavSheet`) con padding por safe-area.
- **Touch targets:** En dispositivos táctiles (`hover: none` y `pointer: coarse`), botones (`.btn`, `.btnSm`) y `.sapNavItem` tienen `min-height: 44px` y `min-width: 44px`; `.modalClose` también 44px y posicionado con safe-area.
- **Scroll iOS:** `-webkit-overflow-scrolling: touch` en `mobileNavSheet`.
- **Overflow:** `overflow-x: hidden` en `html` y `body` para evitar scroll horizontal. `padding-bottom: env(safe-area-inset-bottom)` en `body` para el indicador de inicio en iPhone.

### Layout
- El `viewport` en `layout.tsx` ya tenía `viewportFit: 'cover'` para que las safe-area insets funcionen en iPhone.

---

## 3. Validación recomendada

- **Desktop:** Abrir cada modal (Eliminar familia, Reportes, Presupuesto, Responsables, Integrantes), usar Cerrar/Cancelar y la acción principal; comprobar que no queden dobles Cerrar y que el estilo sea consistente.
- **iPhone (o Safari iOS):** Probar en dispositivo o simulador: que el header no quede bajo el notch, que los botones sean fáciles de tocar (44pt), que no haya scroll horizontal y que el menú lateral y los modales respeten safe area (esquina superior e indicador de inicio).
- **Accesibilidad:** Con lector de pantalla, abrir el modal "Eliminar familia" y comprobar que anuncie el título y que el botón "Cerrar" tenga etiqueta.

---

## 4. Notas

- Los valores internos de pestañas (`'objetos'`, etc.) no se cambiaron; solo la UI visible.
- Si en el futuro se añaden más modales, conviene reutilizar el mismo patrón: un solo botón Cerrar `btnGhost btnSm` con `aria-label="Cerrar"` y, en el panel, `role="dialog"` y `aria-labelledby` apuntando al título.
