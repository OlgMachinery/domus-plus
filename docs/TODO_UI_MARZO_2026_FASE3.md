# TODO UI — Fase 3 (marzo 2026)

## Listado de tareas

| # | Tarea | Acción |
|---|--------|--------|
| 1 | **Reportes congelado** | Revisar y corregir: overlay a pantalla completa opaco, z-index alto, overflow/scroll del panel para que no quede bloqueado. |
| 2 | **Reportes: se ve otro modal detrás** | Asegurar que el overlay de Reportes tape todo (fondo sólido, 100% viewport, sin transparencia). |
| 3 | **Menú principal tipo iPhone** | Rediseñar el menú (móvil y/o escritorio) tipo iPhone: agrupar ítems, menos botones a la vez, más estratégico (secciones, iconos si aplica). |
| 4 | **Menú de Transacciones tipo iPhone** | Rediseñar la barra de filtros/acciones de Transacciones tipo iPhone; **mostrar siempre el último mes** por defecto al entrar. |
| 5 | **Partidas: botón Menú** | En Setup/Objetos presupuestales añadir botón "Menú" que lleve a /ui; **quitar botón Cerrar** (con Menú basta para salir). |
| 6 | **Arquitectura: Menú y quitar Cerrar** | Añadir botón "Menú" (ir a /ui); **quitar botón Cerrar** (salir por Menú). |

---

## Opinión: ¿Cerrar o solo Menú?

- **En modales** (Reportes, Presupuesto, wizard comprobante): tiene sentido **mantener Menú y Cerrar**. "Menú" abre la navegación; "Cerrar" cierra el modal y vuelve al contexto anterior. Son acciones distintas.
- **En páginas a pantalla completa** (Partidas, Arquitectura): son rutas propias (/setup/objects, /ui/system-architecture). Ahí **un solo botón "Menú"** que lleve a /ui es suficiente; se puede **quitar "Cerrar"** para no duplicar la misma acción y unificar criterio: "salir = Menú".

Implementación: en Partidas y Arquitectura se añade "Menú" y se elimina "Cerrar".

---

## Estado de implementación

- **1–2** ✅ Reportes: overlay `.reportsOverlay` con z-index 100, fondo sólido #f5f6f9, 100% viewport. `.reportsStudioBody` con `overflow: auto` para que no se congele el scroll.
- **3** ✅ Menú principal: rediseño tipo iPhone con grupos "Principal" (Dashboard, Transacciones, Reportes), "Familia" (Usuarios, Configuración), "Más" (Partidas, Arquitectura). Clases `.mobileNavSheetIphone`, `.mobileNavGroup`, `.mobileNavItem`, etc.
- **4** ✅ Transacciones: `useEffect` al entrar a la vista fuerza "Mes actual" y fechas del mes. Barra de filtros con clase `.txFilterBarIphone` (estilo iOS).
- **5** ✅ Partidas: botón "Cerrar" sustituido por "Menú" (misma acción: ir a /ui).
- **6** ✅ Arquitectura: botones "Cerrar" sustituidos por "Menú" (ir a /ui).
