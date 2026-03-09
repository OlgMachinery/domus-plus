# Análisis: dos modelos presupuestales en DOMUS+

## 1. Confirmación: existen dos modelos paralelos

### Modelo tradicional (categoría/subcategoría) — `/budgets`

- **Tablas:** `family_budgets`, `user_budgets`, `custom_categories`, `custom_subcategories`.
- **Concepto:** Presupuesto por **familia** con `category` y `subcategory` en VARCHAR (texto libre o catálogo). Opcionalmente `custom_category_id` / `custom_subcategory_id`. Tipo compartido/individual y reparto entre usuarios vía `user_budgets` (allocated_amount, spent_amount).
- **Rutas que lo usan:** `/budgets`, `/budget-summary`, `/personal-budget`, `/reports`, APIs de presupuestos (`/api/budgets/*`), importación Excel, asignación de recibos, AI assistant (optimize, report, etc.).
- **Transacciones:** Tienen `family_budget_id` (opcional). Al crear/editar transacción se puede elegir un presupuesto de familia para “vincular”; no es obligatorio. También guardan `category` y `subcategory` en texto.

### Modelo nuevo (entidad + categoría) — `/budget-overview`

- **Tablas:** `budget_entities`, `budget_categories`, `entity_budget_allocations` (creadas por la migración `20250219_budget_entities_and_categories.sql`).
- **Concepto:** **Entidades** (persona, vehículo, propiedad, grupo) con **categorías** (global, personal, asset) y asignación mensual por par (entity_id, category_id): `monthly_limit`, `spent_amount`. El trigger `update_entity_budget_spent` actualiza `spent_amount` cuando una transacción tiene `budget_entity_id` y `budget_category_id`.
- **Rutas que lo usan:** Solo `/budget-overview`, que consume `/api/budget/summary` (lee `entity_budget_allocations` y arma resumen global + por entidad).
- **Transacciones:** La migración añade a `transactions` las columnas `budget_entity_id` y `budget_category_id` (UUID, NULL). El frontend **no las usa**: en ninguna pantalla se envían ni se muestran. Solo el seed/trigger del modelo nuevo asumen que existen.

---

## 2. Confirmación: transacciones no están vinculadas obligatoriamente a entity/category

- En **schema base** (`schema.sql`): `transactions` tiene `family_budget_id` opcional. **No** tiene `budget_entity_id` ni `budget_category_id`.
- Si se aplica la **migración** `20250219`: se añaden `budget_entity_id` y `budget_category_id` como **NULL** (opcionales).
- En el **frontend** (crear/editar transacción): solo se envían `user_id`, tipo, monto, fecha, `category`/`subcategory` (texto), concepto, comercio y opcionalmente `family_budget_id`. No hay ningún uso de `budget_entity_id` ni `budget_category_id`.
- **Conclusión:** Las transacciones actuales **no** están vinculadas obligatoriamente a `budget_entity_id` ni `budget_category_id`. De hecho, la app no los rellena. La vinculación opcional que existe es `family_budget_id` (modelo tradicional).

---

## 3. Resumen de convivencia actual

| Aspecto | Modelo tradicional | Modelo nuevo |
|--------|--------------------|--------------|
| Tablas | family_budgets, user_budgets, custom_categories, custom_subcategories | budget_entities, budget_categories, entity_budget_allocations |
| Vista principal | /budgets (tabla por categoría/subcategoría) | /budget-overview (resumen por entidad) |
| Transacciones | family_budget_id opcional; category/subcategory texto | budget_entity_id, budget_category_id opcionales; no usados en UI |
| Origen de datos | CRUD en app, Excel, APIs | Solo migración + seed; sin CRUD en app para entidades/categorías nuevas |
| Gasto “contabilizado” | user_budgets.spent_amount (lógica en APIs) | entity_budget_allocations.spent_amount (trigger en DB) |

No hay un solo “origen de verdad”: presupuesto y gasto se reparten entre dos conjuntos de tablas y dos flujos de UI.

---

## 4. Estrategias posibles

Objetivo: **un solo modelo oficial**, sin mezclar lógicas en producción.

---

### A) Migración total al modelo nuevo (entidad + categoría)

**Idea:** El modelo oficial pasa a ser entidad + categoría. Todo presupuesto y todo vínculo de transacciones se expresa con `budget_entity_id` + `budget_category_id`. Se deja de usar `family_budgets` / `user_budgets` para lo nuevo y se migran datos y flujos.

**Ventajas:** Un solo modelo, gasto por entidad/categoría consistente con trigger, vista por entidad nativa.

**Riesgos y trabajo:**

1. **Datos:** Script de migración que, para cada `family_budget` (y sus user_budgets), cree o reutilice entidades/categorías y filas en `entity_budget_allocations`, y opcionalmente rellene `budget_entity_id`/`budget_category_id` en transacciones que hoy tienen `family_budget_id` (mapeo family_budget → entity+category según reglas que definas).
2. **UI:** Sustituir /budgets por una vista que trabaje con entidades y categorías (CRUD de entidades, categorías, asignaciones). /budget-overview pasa a ser la vista principal o una de las principales.
3. **Transacciones:** En crear/editar transacción, sustituir (o complementar) el selector de “presupuesto familia” por entidad + categoría y guardar `budget_entity_id` y `budget_category_id`. Definir si el vínculo es obligatorio o opcional.
4. **APIs y reportes:** Todas las rutas que hoy leen family_budgets / user_budgets (resumen, reportes, Excel, AI, asignación de recibos) deben pasar a leer entity_budget_allocations (y entidades/categorías) o una capa que las unifique durante la transición.
5. **No romper producción:** Hacer la migración en fases: primero añadir columnas y tablas (ya está si la migración 20250219 está aplicada), luego script de migración de datos en ventana de bajo uso, luego cambiar backend para escribir en el modelo nuevo y leer de ambos si hace falta, luego cambiar frontend y por último deprecar escritura en family_budgets.

**Recomendación:** Solo si quieres que el concepto “presupuesto por entidad” sea el eje de todo el producto. Requiere plan de migración por fases y pruebas exhaustivas.

---

### B) Convivencia temporal (dos modelos, un oficial)

**Idea:** Se define **un** modelo como oficial (por ejemplo el tradicional) y el otro se mantiene solo para lectura o para un flujo acotado, sin mezclar reglas de negocio (por ejemplo “gasto” calculado de una sola forma para reportes y alertas).

**Opción B1 – Oficial tradicional**

- **Oficial:** family_budgets + user_budgets. Crear/editar presupuestos, transacciones y reportes usan solo este modelo. `family_budget_id` (y category/subcategory) es el vínculo de transacciones que cuenta.
- **Secundario:** budget_entities + budget_categories + entity_budget_allocations. Solo para /budget-overview: si la migración está aplicada y hay datos (p.ej. seed), la pantalla muestra resumen; si no, se muestra vacío o mensaje “Configura entidades en…”.
- **Transacciones:** No se piden ni se guardan `budget_entity_id` ni `budget_category_id`. Se documenta que “Resumen por entidad” es informativo y puede estar vacío o desfasado.
- **Ventaja:** Cero riesgo en flujos actuales; no se toca creación de presupuestos ni de transacciones.
- **Desventaja:** Dos fuentes de verdad si alguien escribe en entity_budget_allocations por otro medio; /budget-overview no refleja el mismo “gasto” que el resto de la app.

**Opción B2 – Oficial entidad + categoría (solo lectura del tradicional)**

- **Oficial:** Entidad + categoría para todo lo nuevo. CRUD de entidades, categorías y asignaciones; transacciones con `budget_entity_id` + `budget_category_id` (obligatorio u opcional según regla de negocio).
- **Secundario:** family_budgets en solo lectura para /budgets y reportes antiguos: se muestran datos históricos, sin crear nuevos presupuestos por ahí. Opcionalmente un job que rellene entity_budget_allocations a partir de family_budgets para tener resumen unificado.
- Requiere implementar CRUD del modelo nuevo y cambiar transacciones a entity/category; más trabajo que B1.

**Recomendación:** B1 es la opción más rápida y segura para “definir uno oficial sin romper producción”: oficial = tradicional, modelo entidad/categoría solo lectura o informativo.

---

### C) Deprecación del modelo viejo (tradicional)

**Idea:** El modelo oficial pasa a ser **solo** entidad + categoría. Se deja de usar family_budgets para nuevos presupuestos y se anuncia que ese flujo está deprecado; a medio plazo se oculta o se elimina la UI que crea/edita family_budgets.

**Pasos típicos:**

1. **Comunicación:** Documentar y avisar que “Presupuestos por categoría/subcategoría (/budgets)” está en modo solo lectura o deprecado; el camino recomendado es “Resumen por entidad” y el nuevo CRUD de entidades/categorías.
2. **UI:** Quitar o ocultar “Crear presupuesto” en /budgets (o redirigir a la nueva pantalla). Mantener /budgets como consulta histórica.
3. **Datos:** No borrar family_budgets; conservar para histórico y para posibles reportes que sigan leyendo esos datos. Opcional: script que migre family_budgets → entity_budget_allocations para que /budget-overview tenga datos.
4. **Transacciones:** Igual que en A: en crear/editar, usar entidad + categoría y persistir `budget_entity_id` y `budget_category_id`. Mantener `family_budget_id` solo para transacciones antiguas si quieres.
5. **APIs:** Nuevas funcionalidades solo con modelo nuevo; las que dependan de family_budgets pasan a “legacy” y a medio plazo se sustituyen o se apagan.

**Ventaja:** Un solo modelo a futuro, sin duplicar lógica. **Desventaja:** Mismo esfuerzo que A en migración de datos y cambio de flujos, más la gestión de “deprecado” en UI y documentación.

---

## 5. Recomendación resumida

- **Confirmado:** Hay dos modelos paralelos; las transacciones **no** están vinculadas obligatoriamente a `budget_entity_id` ni `budget_category_id`, y hoy la app no usa esas columnas.
- **Si prioridad es no romper producción y definir un oficial ya:**  
  **Estrategia B (convivencia)** con **modelo oficial = tradicional** (B1): /budgets y family_budgets como verdad; /budget-overview como vista informativa opcional sobre entity_budget_allocations si existen datos.
- **Si prioridad es que el producto gire alrededor de “presupuesto por entidad”:**  
  **Estrategia A (migración total)** o **C (deprecación)** al modelo entidad + categoría, con plan por fases (datos, backend, frontend, deprecación) y sin mezclar las dos lógicas en una misma pantalla o regla de negocio.

Si indicas cuál quieres (A, B o C), se puede bajar a un plan de tareas concretas (orden de cambios, scripts SQL y cambios de API/frontend) sin romper producción.
