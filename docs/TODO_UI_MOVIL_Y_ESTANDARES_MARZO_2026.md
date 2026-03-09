# TODO UI móvil y estándares (marzo 2026)

Resumen de tareas pedidas y estado, más opinión/sugerencias.

---

## TODO list (estado)

| # | Tarea | Estado |
|---|--------|--------|
| 1 | **Presupuesto en móvil**: vista muy visualizable, solo lectura (no editar) | ✅ Hecho: en `max-width: 920px` se oculta `.presupuestoConcentradoActions` (selector Año, Integrantes, Editar presupuesto, Confirmar plan). Se mantienen título, pills y KPI. |
| 2 | **Botón Subir comprobante / Registrar gasto**: unificar texto o aclarar función | ⏸️ Cancelado: se mantiene "Subir comprobante" en el botón rápido; el flujo sigue siendo el mismo (registrar gasto desde comprobante). |
| 3 | **Portal usuarios**: formulario menos alto, espacio para scroll | ✅ Hecho: en móvil menos padding en `.usuariosAddCard`, menos gap en `.usuariosAddForm`, inputs más bajos; `.sapContent.viewUsuarios .cardBody` con `overflow-y: auto` y padding inferior para scroll. |
| 4 | **Modal Reportes**: botón Cerrar sin superponer pestañas | ✅ Hecho: `padding-right` de `.reportsStudioToolbar` subido a 64px para dejar hueco al botón Cerrar. |
| 5 | **Texto "solicitudes de afectivo"** | ✅ Revisado: en el código solo existe "Solicitudes de efectivo" (efectivo = dinero). Menú lateral dice "Solicitudes". Si en algún sitio se ve "afectivo", sería errata o autocorrector; no hay ocurrencia en código. |
| 6 | **Objetos presupuestales**: Cerrar arriba derecha, rojo | ✅ Hecho: en `setup/objects/page.tsx` el botón Cerrar está al final de `sapHeaderRight` (derecha) y con clase `btnDanger` (rojo). |
| 7 | **Arquitectura del sistema**: Cerrar arriba derecha, estándar | ✅ Hecho: botón Cerrar con `marginLeft: 'auto'` y clase `btnDanger`; el del desplegable "Más" también usa `btnDanger`. |

---

## Archivos tocados

- **domus-beta-dbe/src/app/setup/objects/page.tsx**: Cerrar a la derecha, `btnDanger`.
- **domus-beta-dbe/src/app/ui/page.tsx**: presupuesto con `.presupuestoConcentradoActions` envuelto; `sapContent` con clase `viewUsuarios` cuando `view === 'usuarios'`.
- **domus-beta-dbe/src/app/ui/system-architecture/page.tsx**: Cerrar con `btnDanger` en toolbar y en "Más".
- **domus-beta-dbe/src/app/styles/dashboard.css**: media `max-width: 920px` para ocultar `.presupuestoConcentradoActions`.
- **domus-beta-dbe/src/app/styles/components.css**: media móvil para `.usuariosAddCard` / `.usuariosAddForm` y para `.sapContent.viewUsuarios .cardBody` (scroll).
- **domus-beta-dbe/src/app/styles/reports.css**: `padding-right: 64px` en `.reportsStudioToolbar`.

---

## Opinión y sugerencias

1. **Presupuesto en móvil**  
   Tiene sentido que en teléfono sea solo consulta: KPI, pills y tablas de solo lectura. La edición (año, integrantes, editar presupuesto, confirmar plan) queda para escritorio o para un flujo explícito "Editar" que en móvil podría abrir otra pantalla/modal si más adelante se quiere.

2. **Botón "Subir comprobante"**  
   "Subir comprobante" es concreto y describe la acción; "Registrar gasto" describe el resultado. Mantener "Subir comprobante" en el botón y, si se quiere, aclarar en tooltip o ayuda que también registra el gasto.

3. **Cerrar (estándar)**  
   Un solo estándar (arriba derecha, rojo) en Objetos, Arquitectura, Reportes y modales reduce confusión y alinea con lo pedido.

4. **Portal usuarios**  
   En móvil, formulario más compacto y contenedor con scroll garantizado suele ser suficiente; si en algún dispositivo sigue cortado, se puede bajar más el padding o agrupar campos en acordeón.

5. **Solicitudes en menú**  
   El ítem "Solicitudes" en el menú lateral sigue siendo útil para ir directo a la lista; el botón rápido del dashboard no lo sustituye del todo. Si se quiere simplificar el menú móvil, se podría valorar quitar "Solicitudes" del sidebar en `max-width: 920px` y dejar solo el acceso desde el dashboard (ya se ocultó el botón Solicitudes del header en móvil con `sapHeaderSolicitudes`).

6. **Deploy**  
   Para ver los cambios en **domus-fam.com** hay que desplegar con `domus-beta-dbe/deploy/deploy-vps.sh` (con `--chown deploy`). Tras el deploy, comprobar `https://domus-fam.com/api/build-info` y la página en incógnito.
