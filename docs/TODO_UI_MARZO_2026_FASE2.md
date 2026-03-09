# TODO UI — Fase 2 (marzo 2026)

Listado de tareas. **Implementado** (confirmado por usuario).

---

## 1. Eliminar “Overview financiero (estilo SAP-Family)”

| Qué hacer | Dónde |
|-----------|--------|
| Quitar el subtítulo del Dashboard que dice *"Overview financiero (estilo SAP-Family)"*. | `page.tsx`: `pageInfo` para vista `'dashboard'` (aprox. línea 3733). Actualmente `subtitle: 'Overview financiero (estilo SAP-Family)'`. |
| Cómo queda | El Dashboard seguirá mostrando título "Dashboard"; el subtítulo puede quedar vacío, un texto más neutro (ej. "Resumen") o no mostrarse si está vacío. |

---

## 2. Ocultar el botón “Presupuesto” en la versión móvil

| Qué hacer | Dónde |
|-----------|--------|
| En móvil, ocultar el ítem de navegación **Presupuesto** (que lleva a la vista Presupuesto). | • **Menú móvil** (panel que se abre con "Menú"): botón "Presupuesto" (aprox. líneas 4168–4170). Añadir clase CSS y `display: none` en `max-width: 920px`, o no renderizar ese botón en móvil. <br>• **Sidebar escritorio**: opcional mantener "Presupuesto" visible en desktop. |
| Cómo queda | En móvil no se verá la opción "Presupuesto" en el menú; la vista Presupuesto seguirá existiendo y podrá abrirse por otros medios si los hay (ej. enlaces desde Dashboard). En escritorio el botón Presupuesto se mantiene. |

---

## 3. Rediseño de “Registrar gasto” en Transacciones (solo UI, sin romper función)

| Qué hacer | Dónde |
|-----------|--------|
| Rediseñar **solo la parte visual** de la sección "Registrar gasto" en la vista Transacciones: estilo más tipo iPhone (amigable, profesional, intuitivo). | Bloque en `page.tsx` cuando `view === 'transacciones'`: cabecera "Registrar gasto", tabs "Con comprobante" / "Sin comprobante", texto intro, botón "Registrar gasto con comprobante", y el formulario "Sin comprobante" (cuenta, monto, etc.). Estilos en `dashboard.css` o `components.css` (clases tipo `.txAddHeader`, `.txAddReceiptIntro`, `.txAddManualGrid`, etc.). |
| Restricción | No cambiar lógica: mismos estados, mismos `onClick`/`onChange`, mismas rutas/APIs. Solo cambiar estructura de marcado (divs, clases) y CSS (espaciado, tipografía, bordes, colores, toques tipo iOS). |

---

## 4. Reportes: header con Menú y DOMUS (estandarización)

| Qué hacer | Dónde |
|-----------|--------|
| En el **modal de Reportes**, añadir un header de estandarización con **Menú** y **DOMUS+** (igual que en el resto de la app). | Modal Reportes: actualmente tiene barra con título "Reportes", pestañas (Detalle, Resumen, Tablas, Consumo), filtros y botones (Menú, Limpiar, Exportar, Cerrar). Añadir una **barra superior** fija con: [Menú] [DOMUS+] (y opcionalmente Cerrar sesión a la derecha si aplica), para que al abrir Reportes se vea el mismo “header” que en Dashboard/Presupuesto/Transacciones. |
| Cómo queda | El modal de Reportes tendrá una primera fila con Menú + DOMUS+; debajo, la barra de "Reportes" + pestañas + filtros. Sin quitar el botón "Menú" que ya está en la toolbar. |

---

## 5. Solicitudes de efectivo (aclaración y flujo)

| Qué hacer | Notas |
|-----------|--------|
| **Sin cambio de flujo.** Solo documentar/confirmar: la vista "Solicitudes de efectivo" es donde el usuario **realiza** la solicitud; desde ahí se genera el mensaje por WhatsApp y llega al admin como solicitud. | El comportamiento actual (crear solicitud → notificación admin) se mantiene. No se pide cambiar lógica en este TODO. |

---

## 6. Dashboard: botón “Aprobaciones de solicitudes” (solo Admin) + estilo iPhone

| Qué hacer | Dónde |
|-----------|--------|
| En el **mismo bloque de botones rápidos del Dashboard** (donde están "Subir comprobante" y "Solicitudes"), añadir un **tercer botón**: **"Aprobaciones de solicitudes"** (o texto acordado), con el mismo estilo tipo iPhone. | `page.tsx`: bloque `dashboardQuickActionsMobile` (aprox. líneas 4634–4641). Añadir un botón que navegue a la vista de solicitudes (o a un estado/modal de “pendientes de aprobar”). |
| Visibilidad | El botón **solo debe mostrarse para usuarios Admin** (`meOk.isFamilyAdmin === true`). Los usuarios no admin no lo ven. |
| Cómo queda | En móvil, en el Dashboard: 1) Subir comprobante, 2) Solicitudes, 3) Aprobaciones de solicitudes (solo si es Admin). Los tres con estilo tipo iPhone (ya aplicado a los dos primeros). |

---

## Resumen de archivos a tocar (estimado)

| Archivo | Cambios |
|---------|--------|
| `domus-beta-dbe/src/app/ui/page.tsx` | 1) Subtitle Dashboard; 2) Ocultar Presupuesto en nav móvil; 3) Rediseño HTML/clases de "Registrar gasto"; 4) Header Menú+DOMUS en modal Reportes; 6) Botón "Aprobaciones de solicitudes" condicionado a Admin. |
| `domus-beta-dbe/src/app/styles/dashboard.css` y/o `components.css` | 3) Estilos tipo iPhone para la sección Registrar gasto; 6) Estilo del nuevo botón si hace falta. |
| `domus-beta-dbe/src/app/styles/layout.css` o `reports.css` | 2) Clase para ocultar ítem Presupuesto en móvil; 4) Ajustes de layout del header en Reportes si aplica. |

---

## Orden sugerido de implementación

1. Quitar subtítulo "Overview financiero (estilo SAP-Family)" y ocultar botón Presupuesto en móvil (rápido y sin riesgo).
2. Añadir header Menú + DOMUS en el modal de Reportes.
3. Añadir botón "Aprobaciones de solicitudes" en Dashboard (solo Admin), estilo iPhone.
4. Rediseño visual de "Registrar gasto" en Transacciones (solo UI).

---

## Estado de implementación

- **1** ✅ Subtítulo "Overview financiero (estilo SAP-Family)" eliminado; subtítulo vacío no se muestra.
- **2** ✅ Ítem "Presupuesto" quitado del menú móvil (panel que se abre con "Menú").
- **3** ✅ Sección "Registrar gasto" en Transacciones rediseñada: bloque `.txAddBlock` con título, subtítulo, control segmentado (Con/Sin comprobante), botón azul tipo iPhone y formulario manual con mismo flujo.
- **4** ✅ Modal Reportes: barra superior `.reportsStudioHeader` con botón "Menú" y marca "DOMUS+".
- **5** ✅ Sin cambios (solo aclaración de flujo de solicitudes).
- **6** ✅ Botón "Aprobaciones de solicitudes" añadido en Dashboard (bloque rápido móvil), solo visible si `meOk?.isFamilyAdmin`; estilo naranja `.dashboardQuickBtnApprovals`.
