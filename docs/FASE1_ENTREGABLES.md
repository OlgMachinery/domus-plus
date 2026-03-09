# Fase 1 — Entregables (Setup Wizard, Task Spec raíz → tronco)

Resumen de lo implementado para la Fase 1. **No se ha modificado** el comportamiento de transacciones, dashboard ni `/budgets`. **No se ha activado** el switch del modelo nuevo. **No se ha tocado** el trigger actual.

---

## 1. Lista de nuevas rutas creadas

| Ruta | Método | Propósito |
|------|--------|-----------|
| **`/setup`** | GET (página) | Wizard de configuración en 5 pasos (solo contenido; la ruta es una página Next.js). |
| **`/api/setup/status`** | GET | Devuelve `hasFamily`, `setupComplete`, `planStatus`, `currentStep`, `familyId`, `isAdmin`. Usado por el gate y el indicador de setup. |
| **`/api/setup/entities`** | GET, POST | Listar y crear entidades (solo Admin). |
| **`/api/setup/entities/[id]`** | PATCH, DELETE | Editar y eliminar entidad (solo Admin). |
| **`/api/setup/categories`** | GET, POST | Listar y crear categorías (solo Admin). |
| **`/api/setup/categories/[id]`** | PATCH, DELETE | Editar y eliminar categoría (solo Admin). |
| **`/api/setup/plan`** | GET, POST | GET: entidades, categorías y asignaciones para el Paso 5. POST: guardar borrador (upsert asignaciones, `plan_status` = DRAFT). |
| **`/api/setup/plan/confirm`** | POST | Valida con `can_set_setup_complete`; si ok, marca `plan_status` = CONFIRMED y `setup_complete` = true. |

**Rutas existentes modificadas (solo extensión, sin cambiar flujo actual):**

- **`/api/families/[id]`** (PATCH): se aceptan además `currency`, `cutoff_day`, `budget_start_date` para el Paso 1.
- **`/api/users/create`** (POST): se aceptan y persisten `can_register_expenses`, `can_upload_receipts`, `can_create_events`, `can_view_global_summary`.
- **`/api/users/[id]`** (PATCH): el admin puede actualizar los mismos cuatro permisos del integrante.

---

## 2. Nuevas columnas y tablas agregadas

**Migración:** `supabase/migrations/20250220_setup_wizard_fase1.sql`

### Tabla `families` (columnas nuevas)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `currency` | VARCHAR(3) DEFAULT 'MXN' | Moneda de la familia. |
| `cutoff_day` | INTEGER DEFAULT 1, CHECK 1–31 | Día de corte mensual. |
| `budget_start_date` | DATE | Fecha de inicio de presupuesto. |
| `setup_complete` | BOOLEAN DEFAULT false | Solo se pone en true cuando el plan está confirmado y se cumplen todas las condiciones. |
| `plan_status` | TEXT DEFAULT 'DRAFT', CHECK ('DRAFT', 'CONFIRMED') | Estado del plan del periodo. |

### Tabla `users` (columnas nuevas)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `can_register_expenses` | BOOLEAN DEFAULT true | Puede registrar gastos. |
| `can_upload_receipts` | BOOLEAN DEFAULT true | Puede subir tickets. |
| `can_create_events` | BOOLEAN DEFAULT false | Puede crear eventos (guardado para uso futuro). |
| `can_view_global_summary` | BOOLEAN DEFAULT false | Puede ver resumen global. |

### Tabla `budget_categories`

- **CHECK de `type`:** se añade el valor `'FAMILY'`. Valores permitidos: `'GLOBAL'`, `'PERSONAL'`, `'ASSET'`, `'FAMILY'`.
- **Uso de GLOBAL vs FAMILY:**  
  - **GLOBAL** se mantiene: categorías que aplican a **cualquier tipo de entidad** (PERSON, VEHICLE, PROPERTY, GROUP). Uso: gastos genéricos o transversales.  
  - **FAMILY** es para gasto **compartido / grupo** (Hogar, Super): solo compatible con entidades tipo GROUP.  
  - En el flujo nuevo ambos están disponibles; no se elimina GLOBAL.

### Funciones nuevas (BD)

- **`can_set_setup_complete(p_family_id INTEGER)`**: devuelve `(ok BOOLEAN, reason TEXT)`. Comprueba: ≥1 PERSON activa, ≥1 GROUP activa, categorías activas, ≥1 asignación con monto > 0, `plan_status` = CONFIRMED. Solo si todo se cumple se permite marcar `setup_complete` = true.
- **`is_family_admin(p_user_id UUID)`**: ya existía en otros scripts; se (re)define en esta migración para RLS.

**No se han creado tablas nuevas**; solo columnas y una función de validación.

---

## 3. Cambios en RLS

- **`budget_entities`:** la política “Family members can manage” se sustituye por **“Admin can manage budget_entities”**: INSERT/UPDATE/DELETE solo si `get_user_family_id(auth.uid()) = family_id` y `is_family_admin(auth.uid()) = true`. SELECT sigue pudiendo usarse para miembros de la familia (políticas “can view” se mantienen).
- **`budget_categories`:** igual: **“Admin can manage budget_categories”** con la misma condición.
- **`entity_budget_allocations`:** igual: **“Admin can manage entity_budget_allocations”** con la misma condición.

Así, solo el admin de la familia puede crear, editar o eliminar entidades, categorías y asignaciones del plan. Los integrantes solo pueden leer (según las políticas de SELECT existentes).

---

## 4. Flujo exacto del wizard implementado

1. **Paso 0 (gate)**  
   - Usuario sin `family_id` que entra a `/dashboard` → redirección a `/setup`.  
   - **Usuario con `family_id` pero `setup_complete` = false y es admin** → redirección a `/setup` (para completar el wizard).  
   - No se modifica la lógica interna del dashboard ni de transacciones.

2. **Paso 1 — Crear familia**  
   - Campos: nombre, moneda, día de corte (1–31), fecha inicio presupuesto.  
   - Si no hay familia: POST `/api/families` (nombre) y luego PATCH con `currency`, `cutoff_day`, `budget_start_date`.  
   - Si ya hay familia: PATCH `/api/families/[id]` con los mismos campos.  
   - Botones: “Crear familia y continuar” / “Guardar y continuar”. Validación: nombre y día de corte obligatorios/válidos.

3. **Paso 2 — Integrantes y roles**  
   - Lista de miembros desde GET `/api/families` (o `/api/families/[id]`).  
   - Agregar: nombre, email, contraseña, toggles (puede registrar gastos, subir tickets, crear eventos, ver resumen global).  
   - Guardar integrante: POST `/api/users/create` con permisos.  
   - Navegación: Atrás, Continuar.

4. **Paso 3 — Entidades**  
   - GET/POST `/api/setup/entities`. Por entidad: nombre, tipo (PERSON, VEHICLE, PROPERTY, GROUP), activa.  
   - Validación en UI: recordatorio de “al menos 1 PERSON y 1 GROUP”.  
   - Navegación: Atrás, Continuar.

5. **Paso 4 — Categorías**  
   - GET/POST `/api/setup/categories`. Por categoría: nombre, tipo (PERSONAL, ASSET, FAMILY, GLOBAL), activa.  
   - Navegación: Atrás, Continuar.

6. **Paso 5 — Plan del periodo**  
   - GET `/api/setup/plan`: devuelve entidades, categorías y asignaciones actuales.  
   - Por entidad (tabs/selector) se muestran solo categorías compatibles (PERSON → PERSONAL/FAMILY/GLOBAL; VEHICLE/PROPERTY → ASSET/GLOBAL; GROUP → FAMILY/GLOBAL).  
   - Por cada par (entidad, categoría): checkbox “Activa” y **monto mensual** (`monthly_limit`).  
   - **Desactivación:** al desactivar una categoría para una entidad **no se elimina** la fila en `entity_budget_allocations`. Se hace **UPDATE `is_active` = false**. La fila y `spent_amount` (histórico de gastos) se mantienen. Bajo ninguna circunstancia se borra físicamente una asignación si existen gastos relacionados.  
   - **`entity_budget_allocations.is_active`** se usa solo para activar/desactivar líneas del plan. El histórico de gastos (trigger que actualiza `spent_amount`) **no depende** de si la asignación está activa o no.  
   - **En Fase 1 solo se persisten `monthly_limit` e `is_active`** en asignaciones. Los campos del Task Spec (control estricto/flexible, alerta %, permite exceder, requiere aprobación, sobrante acumulable) **no se implementan en Fase 1**; quedan documentados para **Fase 1.5** (o fase posterior).  
   - Consolidación en vivo: total por entidad y total global.  
   - “Guardar plan (borrador)”: POST `/api/setup/plan` con `allocations`; se deja `plan_status` = DRAFT.  
   - “Confirmar y comenzar a operar”: modal de confirmación; POST `/api/setup/plan/confirm` → validación en backend con `can_set_setup_complete`; si ok, `plan_status` = CONFIRMED y `setup_complete` = true.  
   - El botón “Confirmar…” se deshabilita hasta que haya ≥1 PERSON activa, ≥1 GROUP activa, categorías activas y ≥1 asignación con monto > 0.

7. **Integrante (no admin)**  
   - Si hay familia pero `setup_complete` = false: en `/setup` se muestra “Configuración pendiente por el administrador” y opción de ir al dashboard. No se permite editar el wizard.

8. **Setup completo**  
   - Si `setup_complete` = true, en `/setup` se muestra “Configuración completa” y enlaces a ver plan o ir a “Resumen por entidad”.

---

## 5. Cómo se detecta que el setup está incompleto

- **API:** GET `/api/setup/status`.  
  - Respuesta: `hasFamily`, `setupComplete`, `planStatus`, `currentStep`, `familyId`, `isAdmin`.  
  - **Setup incompleto** cuando:  
  - `hasFamily === false`, o  
  - `hasFamily === true` y `setupComplete === false` (y opcionalmente `planStatus !== 'CONFIRMED'`).

- **Cálculo de `currentStep` (para reanudar):**  
  - Usa **la misma lógica que `can_set_setup_complete`**: no solo “existencia de registros”, sino validación explícita de:  
    - ≥1 entidad tipo **PERSON** activa  
    - ≥1 entidad tipo **GROUP** activa  
    - ≥1 **categoría** activa  
    - ≥1 **asignación** con `monthly_limit` > 0 e `is_active` = true  
  - Sin familia → paso 1.  
  - Con familia: si falta PERSON o GROUP → paso 3 (entidades); si falta categoría activa → paso 4; si falta asignación con monto > 0 → paso 5; si todo se cumple pero no confirmado → paso 5.  
  - Si `setup_complete` = true → paso 6 (completo).

- **Validación de `setup_complete` en backend:**  
  - No se puede poner `setup_complete` = true sin llamar a POST `/api/setup/plan/confirm`.  
  - Esa ruta primero pone `plan_status` = CONFIRMED y luego llama a la función `can_set_setup_complete(family_id)`. Solo si devuelve `ok = true` se actualiza `setup_complete` = true.  
  - La función exige: ≥1 PERSON activa, ≥1 GROUP activa, categorías activas, ≥1 asignación con monto > 0 y `plan_status` = CONFIRMED.

- **Indicador en UI:**  
  - En el header del layout (SAPLayout), si el usuario es admin y tiene familia, se hace GET `/api/setup/status` y se muestra:  
  - “Setup completo” (verde) si `setupComplete === true`.  
  - “Configuración incompleta” (ámbar) si no.  
  - En ambos casos el texto enlaza a `/setup`.

- **Gate de redirección:**  
  - En `/dashboard`: (1) si el usuario tiene `family_id` null → redirige a `/setup`; (2) si tiene `family_id` y es **admin** y `setup_complete` = false (según GET `/api/setup/status`) → redirige a `/setup`. Los integrantes (no admin) no se redirigen. No se tocan otras rutas ni el contenido del dashboard.

---

## 6. Categorías: GLOBAL y FAMILY

- **GLOBAL** se mantiene en el flujo nuevo. Uso: categorías que aplican a **cualquier tipo de entidad** (PERSON, VEHICLE, PROPERTY, GROUP). Ejemplo: “Varios” o gastos transversales. Compatibilidad en el wizard: PERSON, VEHICLE, PROPERTY y GROUP pueden tener categorías GLOBAL.
- **FAMILY** es para gasto **compartido / grupo** (Hogar, Super): solo compatible con entidades tipo GROUP. No reemplaza a GLOBAL; ambos conviven.
- Si en el futuro se decidiera eliminar GLOBAL del flujo nuevo, bastaría con quitarlo del CHECK y del selector de tipo en el wizard; por ahora queda documentado y en uso.

---

## 7. Asignaciones: alcance Fase 1 vs Fase 1.5

- **Fase 1 (implementado):** en `entity_budget_allocations` solo se guardan y editan **`monthly_limit`** e **`is_active`** por cada par (entidad, categoría). Es suficiente para activar/desactivar líneas y montos, y para validar `can_set_setup_complete`.
- **Quedan para Fase 1.5 (o fase posterior):**  
  - Control (Estricto / Flexible)  
  - Alerta % (p. ej. 80)  
  - Permite exceder  
  - Requiere aprobación si excede  
  - Sobrante se acumula al siguiente mes  
  Estas columnas o lógicas no existen aún en BD ni en la UI del Paso 5; se documentan aquí para no bloquear la aprobación de Fase 1.

### 7.1 Desactivación en Paso 5: delete vs update is_active (confirmación técnica)

- **Cómo se maneja la desactivación:**  
  **Solo UPDATE `is_active` = false.** No se elimina físicamente la fila en `entity_budget_allocations`. El flujo es: el usuario desmarca “Activa” en la UI → el frontend envía esa asignación en el array `allocations` con `is_active: false` → POST `/api/setup/plan` hace **upsert** (INSERT o UPDATE) con `is_active: isActive`. Si la fila ya existía, se actualiza; la fila **nunca** se borra.

- **Si una asignación desactivada ya tiene gastos asociados:**  
  La fila sigue existiendo con `is_active = false`. El campo **`spent_amount`** se mantiene en esa misma fila. El trigger `update_entity_budget_spent` actualiza `spent_amount` por `(entity_id, category_id)` sin mirar `is_active`; por tanto el histórico de gastos **nunca** depende de si la asignación está activa o no. No se pierde ningún dato ni se rompe la integridad.

- **Rutas donde podría borrarse físicamente una asignación:**  
  **Ninguna.** En el código de la app **no existe** ninguna ruta que haga `DELETE` sobre `entity_budget_allocations`. Las únicas operaciones son: (1) GET para listar, (2) upsert en POST `/api/setup/plan`. Las rutas DELETE de entidades (`/api/setup/entities/[id]`) y de categorías (`/api/setup/categories/[id]`) **no** borran asignaciones: comprueban si hay asignaciones y, si las hay, devuelven error y exigen desactivar en lugar de eliminar la entidad/categoría. No hay endpoint del tipo `DELETE /api/setup/plan/allocations/[id]`.

---

## 8. Qué no se ha hecho (según especificación Fase 1)

- No se modifican transacciones (manual ni ticket).  
- No se activa el switch del modelo nuevo (Fase 2).  
- No se cambia el trigger de gastos.  
- No se modifica el flujo operativo de `/budgets`, ni el dashboard más allá del gate de redirección cuando no hay familia.

Con esto, la Fase 1 queda implementada y lista para tu revisión antes de avanzar a Fase 2.  
Ajustes pre-aprobación: gate ampliado (admin + setup incompleto → /setup), currentStep alineado a `can_set_setup_complete`, GLOBAL documentado y mantenido, asignaciones solo monthly_limit en Fase 1 (resto en Fase 1.5).
