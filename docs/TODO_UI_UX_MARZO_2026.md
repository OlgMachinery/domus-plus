# Sugerencias y TODO list — UI/UX DOMUS+ (marzo 2026)

## Sugerencias de enfoque

1. **Orden recomendado**  
   Conviene atacar primero lo que desbloquea uso diario (flujo solicitud/comprobante, transacciones) y luego consistencia visual (pills, filtros, menú). Dejar para después rediseños grandes (calendario móvil, usuarios tipo iPhone) si el tiempo es limitado.

2. **Dos superficies**  
   - **Web (domus-beta-dbe)** — Lo que se ve en las capturas (Transacciones, Calendario, Usuarios, Partidas, Reportes, Solicitudes) es la app web en `domus-beta-dbe/src/app/ui/page.tsx` (responsive, también en cel).  
   - **App nativa (mobile/)** — Solo algunas pantallas (ej. Solicitudes). Ajustes de “tipo iPhone” aplican sobre todo a la web en vista móvil o, si se prioriza, a las pantallas React Native.

3. **Flujo comprobante/solicitud**  
   Es un bug de flujo: al aprobar una solicitud y subir comprobante, la transacción no pasa de “Pendiente” a “Confirmado” o no se puede “aprobar/confirmar” el comprobante y seguir. Hay que revisar: estado de la transacción, lógica de confirmación del recibo (extraction.confirmedAt) y botones/acciones en el detalle de la transacción.

4. **Menú a la izquierda**  
   Unificar posición del botón “Menú” (siempre a la izquierda en header y modales) para no depender del viewport.

5. **Partidas / listas**  
   “Partidas” puede referirse a categorías, entidades u objetos presupuestales. Aclarar si el problema es: lista corta (límite de resultados), idioma mezclado (es/en) o ambas. Solución: lista completa + etiquetas solo en español (o consistente).

---

## TODO list (priorizado)

### Crítico (flujo y datos)

| # | Tarea | Dónde | Notas |
|---|--------|--------|--------|
| 1 | **Corregir flujo solicitud → comprobante → aprobar/continuar** | API + UI detalle transacción | Al subir comprobante en una solicitud entregada, permitir “Confirmar” el recibo y que el estado pase de Pendiente a Confirmado; poder avanzar al siguiente. Revisar `extraction.confirmedAt`, acciones en modal/detalle de transacción. |
| 2 | **Solicitudes: contenido exclusivo** | Vista Solicitudes (web + móvil) | Asegurar que la vista “Solicitudes” muestre solo solicitudes de efectivo/pago (no mezclar con “aprobar” genérico). Textos y filtros alineados a “solicitudes de efectivo o pago”. |

### Alta (UI visible y usabilidad)

| # | Tarea | Dónde | Notas |
|---|--------|--------|--------|
| 3 | **Reducir tamaño de pills** (Por confirmar, Confirmado, Solicitud efectivo, Pendiente) | Tabla Transacciones, columna Comprobante | Ajustar CSS: menos padding, fuente más pequeña, que no dominen la celda. |
| 4 | **Filtros simétricos y ordenados** | Transacciones, Reportes, Calendario | Misma anchura/altura donde aplique, grid alineado (ej. 2 o 3 columnas en móvil), mismos márgenes. |
| 5 | **Calendario legible en móvil** | Vista Calendario | Celdas más grandes, menos eventos por celda, texto legible o “N eventos” + detalle en lista/modal; vista “Lista” o “Semana” más usable en cel. |
| 6 | **Menú siempre a la izquierda** | Header y modales | Botón “Menú” a la izquierda en todas las vistas y modales (no a la derecha en móvil). |

### Media (listas y contenido)

| # | Tarea | Dónde | Notas |
|---|--------|--------|--------|
| 7 | **Partidas: lista completa y en español** | Setup / Partidas / Categorías | Mostrar toda la lista (sin límite arbitrario); etiquetas en español o esquema consistente (ej. “Persona”, “Casa”, no mezcla PERSON/Persona sin criterio). |
| 8 | **Usuarios: diseño tipo iPhone** | Sección Usuarios | Formulario y lista más claros en móvil: campos grandes, espaciado, lista en tarjetas o filas táctiles; menos tabla densa. |

---

## Resumen de entregables

- **Flujo:** Aprobar solicitud + subir comprobante → poder confirmar recibo y seguir al siguiente (sin quedar en Pendiente).
- **Solicitudes:** Solo solicitudes de efectivo/pago; sin confusión con “aprobar” genérico.
- **Pills:** Tamaño correcto en columna Comprobante.
- **Filtros:** Simétricos y ordenados (Transacciones, Reportes, Calendario).
- **Calendario:** Legible en cel (rediseño o ajuste móvil).
- **Menú:** Siempre a la izquierda.
- **Partidas:** Lista completa, etiquetas consistentes (español).
- **Usuarios:** Diseño más tipo iPhone (fácil revisar/crear).

Cuando indiques por cuál quieres que empiece, se puede bajar al código (archivos y componentes concretos) y hacer los cambios paso a paso.
