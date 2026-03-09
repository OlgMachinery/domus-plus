# Task Spec: Configuración de presupuesto DOMUS+ (refinado)

Documento único de referencia para la implementación del flujo “raíz → tronco”: Entidad → categorías aplicables → monto mensual por categoría → consolidación → activar operación. Incluye validaciones, reglas de edición, periodo, permisos, dashboard y estrategia de implementación.

---

## 1. Estrategia confirmada

- **Estrategia elegida:** **B — Nuevo flujo en paralelo con switch.**
- **Enfoque de implementación:**  
  **Crear el flujo nuevo completamente aislado y luego conectar transacciones.**  
  - El wizard (`/setup`), entidades, categorías y plan del periodo se construyen como flujo nuevo (nuevas pantallas/APIs) sin modificar inicialmente los formularios de transacciones ni el dashboard.
  - Cuando el wizard esté listo y el switch “presupuesto oficial = modelo entidad/categoría” exista, se **conecta** el flujo: transacciones (manual y ticket) exigen entidad + categoría; dashboard y budget-overview leen del modelo nuevo.
  - No se adaptan progresivamente los formularios actuales hasta que el flujo nuevo esté cerrado y probado; así se evitan regresiones y estados intermedios inconsistentes.

---

## 2. Estado del plan y cuándo marcar `setup_complete`

### 2.1 Estado del plan (`plan_status`)

Se definen **dos estados** explícitos del plan del periodo:

| Valor | Significado |
|-------|-------------|
| **DRAFT** | El admin ha guardado borrador (montos, categorías activas) pero no ha pulsado “Confirmar y comenzar a operar”. Puede haber asignaciones y montos; el plan no es oficial. |
| **CONFIRMED** | El admin confirmó explícitamente el plan (confirmación fuerte). El plan pasa a ser el oficial para el periodo. |

- **Dónde guardar:** En familia o en tabla de plan: `plan_status` (enum o texto: `DRAFT` | `CONFIRMED`). Si no existe tabla de plan por periodo, puede vivir en `families` como `current_plan_status` para el periodo activo.
- **Relación con flags:**
  - `setup_complete = true` **solo** cuando `plan_status = CONFIRMED` **y** se cumplan el resto de condiciones (véase tabla siguiente).
  - El **switch real** (presupuesto oficial = modelo entidad/categoría) depende de `plan_status === CONFIRMED` **y** de que el módulo de transacciones adaptado (Fase 2) esté desplegado (véase §7.1). No se activa solo por confirmar el plan si la Fase 2 no está lista.

### 2.2 Cuándo marcar `setup_complete = true`

`setup_complete` **solo** puede marcarse `true` cuando se cumplan **todas** las condiciones:

| # | Condición | Comprobación |
|---|-----------|--------------|
| 1 | Existe al menos **1 entidad tipo PERSON** activa | `budget_entities.type = 'PERSON'` y `is_active = true` |
| 2 | Existe al menos **1 entidad tipo GROUP** activa | `budget_entities.type = 'GROUP'` y `is_active = true` |
| 3 | Existen **categorías activas** | Al menos una fila en `budget_categories` con `is_active = true` |
| 4 | Existe **al menos una asignación con monto > 0** | Al menos una fila en `entity_budget_allocations` con `monthly_limit > 0` e `is_active = true` |
| 5 | El plan fue **confirmado explícitamente** | `plan_status = CONFIRMED` (usuario pulsó “Confirmar y comenzar a operar” y pasó la confirmación fuerte; no basta “Guardar borrador”) |

- Validar en backend (API o función en BD) antes de escribir `setup_complete = true`. Si falta alguna condición, no guardar el flag y devolver mensaje claro indicando qué falta.
- En frontend, el botón “Confirmar y comenzar a operar” puede estar deshabilitado hasta que 1–4 se cumplan; la acción final solo se aplica si el backend valida 1–5 y actualiza `plan_status` a CONFIRMED.
- **Borrador:** Si el admin sale en Paso 5 sin confirmar, se persiste el estado como DRAFT (borrador). Las transacciones **no** deben exigir entidad/categoría ni usar este plan como oficial mientras el switch esté OFF (Fase 2 no desplegada o plan no confirmado). El gate puede seguir redirigiendo al wizard hasta que haya al menos un plan CONFIRMED; el detalle de “permitir o no transacciones con borrador” puede ser: permitir transacciones con el modelo actual (switch OFF) hasta que plan CONFIRMED + Fase 2.

### 2.3 Riesgos ocultos y mitigaciones

| Riesgo | Descripción | Mitigación en esta spec |
|--------|-------------|--------------------------|
| **R1 — Estado intermedio si el admin abandona en Paso 5** | Admin crea entidades, activa categorías, asigna montos parcialmente y sale sin confirmar. ¿Dónde se guarda el borrador? ¿Se permiten transacciones? | **plan_status** DRAFT vs CONFIRMED. Borrador se guarda con `plan_status = DRAFT`. El **switch real** depende de `plan_status === CONFIRMED` y de Fase 2 desplegada (§7.1). Mientras no esté confirmado, no se exige entidad/categoría en transacciones. |
| **R2 — Edición del plan en mitad del periodo** | Si se sobrescribe el plan sin versionado, el histórico puede cambiar. | **Versión única del plan** (§3.1): un solo plan activo por (familia + periodo). Editar no crea nueva versión. El histórico se basa en transacciones reales, no en el monto original del plan. |
| **R3 — Trigger mensual vs periodo con corte** | Si se usa día de corte, un trigger basado en `date_trunc('month', ...)` no basta; el resumen puede no coincidir con el selector de mes. | **Comportamiento del trigger** definido explícitamente (§5): el trigger debe usar la misma lógica de periodo que el resto del sistema. **Fase 1:** usar **mes calendario** para reducir riesgo; día de corte en fases posteriores si se implementa. |
| **R4 — UX al cambiar switch ON** | Si el switch se activa antes de que el formulario de transacciones tenga entidad/categoría, se rompe el flujo. | **Activación del switch** (§7.1): el switch **no** se activa automáticamente al confirmar el plan. Solo se activa cuando el módulo de transacciones (Fase 2) está desplegado. Así el frontend está listo antes de exigir entity/category. |

---

## 3. Reglas de edición (plan / asignaciones)

### 3.1 Versión del plan (único por periodo)

- **Un solo plan activo por periodo:** Por (familia + periodo), existe **un único** plan. No se crean “versiones” al editar.
- **Editar no crea nueva versión:** Las ediciones (montos, categorías activas/desactivadas) **sobrescriben** el mismo plan del periodo. No hay historial de versiones del plan; el histórico de “qué se gastó” se basa en **transacciones reales** (`spent_amount` y transacciones con `budget_entity_id` / `budget_category_id`), no en el monto original guardado en el plan.
- **No cambiar periodo activo sin cerrar:** No se permite cambiar el periodo “activo” (p. ej. pasar a otro mes) sin definir explícitamente el cierre del actual (o se considera que el periodo activo es el actual y solo se edita ese). Evitar tener dos periodos abiertos que generen confusión en resumen y trigger.

| Regla | Comportamiento |
|-------|----------------|
| **Eliminar asignación con gastos** | No permitir **eliminar** una asignación que tenga gastos registrados (transacciones con `budget_entity_id` + `budget_category_id` que apunten a esa asignación). Solo permitir **desactivar** (`is_active = false`) para que deje de aparecer en el plan sin perder historial. |
| **Nuevo monto &lt; gastado actual** | Si el usuario intenta guardar un `monthly_limit` **menor** que el `spent_amount` actual de esa asignación, mostrar **advertencia obligatoria** (modal o inline) y exigir confirmación explícita antes de guardar. Opcional: bloquear guardado y pedir que primero se desactive la categoría o se ajusten gastos. |
| **Recálculo de consolidación** | Cualquier cambio en asignaciones (montos, activar/desactivar) debe **recalcular la consolidación inmediatamente** en la UI (totales por entidad, por categoría, total global). Si el resumen se sirve por API, la API debe devolver datos actualizados tras cada guardado (sin caché obsoleta). |

### 3.2 Categorías: GLOBAL y FAMILY

- **GLOBAL** se mantiene: categorías que aplican a **cualquier tipo de entidad** (PERSON, VEHICLE, PROPERTY, GROUP). Uso: gastos genéricos o transversales.
- **FAMILY** es para gasto compartido/grupo (Hogar, Super): solo compatible con GROUP. No reemplaza a GLOBAL; ambos conviven en el flujo nuevo.

### 3.3 Asignaciones: campos por fase

- **Fase 1:** solo se persisten **`monthly_limit`** e **`is_active`** por (entidad, categoría).
- **Fase 1.5 (o posterior):** control (Estricto/Flexible), alerta %, permite exceder, requiere aprobación si excede, sobrante acumulable. Quedan definidos en el spec pero no implementados en Fase 1.

---

## 4. Transacciones antiguas (sin entity_id / category_id)

| Regla | Comportamiento |
|-------|----------------|
| **No romper el resumen** | Las transacciones que no tengan `budget_entity_id` o `budget_category_id` **no deben romper** el resumen (budget-overview, consolidación, totales). Es decir: solo se consideran en “gastado” las transacciones que sí tengan ambos IDs; las antiguas se ignoran para el cálculo del modelo entidad/categoría. |
| **Sin migración automática** | No se migran automáticamente transacciones antiguas a entidad/categoría. Cualquier asignación de `budget_entity_id` / `budget_category_id` a transacciones existentes debe hacerse **con confirmación explícita del usuario** (p. ej. pantalla “Asignar transacciones al plan” o edición manual por transacción), nunca en background sin consentimiento. |

---

## 5. Periodo: mes calendario vs día de corte

| Punto | Decisión y documentación |
|-------|---------------------------|
| **Definición explícita** | Definir en configuración (y documentar en esta spec) si el sistema usará **mes calendario** (1–último día del mes) o **periodo por día de corte** (ej. corte día 15 → periodo 16 actual – 15 siguiente). Recomendación: soportar **día de corte** almacenado en familia (`cutoff_day`); el “mes” del plan y del selector es entonces el periodo que termina en ese día (ej. “Feb 2025” = del 16 ene al 15 feb si corte = 15). |
| **Selector de mes** | Documentar: el **selector de mes (YYYY-MM)** en budget-overview (y donde aplique) representa **ese periodo según la regla elegida**: si es mes calendario, YYYY-MM = 1 al último día del mes; si es día de corte, YYYY-MM puede interpretarse como “mes que contiene el cierre” (ej. “2025-02” con corte 15 = del 16 ene al 15 feb). La API de resumen debe recibir `year`, `month` (y opcionalmente `cutoff_day`) y devolver datos del periodo correcto. |
| **Trigger de gasto** | El trigger que actualiza `entity_budget_allocations.spent_amount` debe usar **la misma lógica de periodo** que el resto del sistema (mes calendario o día de corte). Si se usa día de corte, **actualizar el trigger** para que no dependa solo de `date_trunc('month', ...)`; en caso contrario el resumen no coincidirá con el selector de mes. |
| **Fase 1 — Decisión explícita** | **En Fase 1 se usará mes calendario** (1–último día del mes) para reducir riesgo y no tocar el trigger existente basado en mes. El día de corte se puede implementar en fases posteriores; cuando se implemente, el trigger y la API de resumen deben adaptarse a la misma regla. |

---

## 6. Permisos y RLS

| Rol | Entidades | Categorías | Plan (asignaciones) | Resumen |
|-----|-----------|------------|----------------------|---------|
| **Admin** | Crear / editar / eliminar (respetando regla “no eliminar si hay gastos”) | Crear / editar / eliminar | Crear / editar / desactivar asignaciones; confirmar plan | Ver todo (global, por entidad, por categoría) |
| **Integrante** | Solo lectura (ver entidades asignadas a su contexto) | Solo lectura (ver categorías activas para sus entidades) | **Nunca** modificar plan ni asignaciones | Solo “Mi Presupuesto” y compartidas si tiene permiso; no resumen global salvo permiso “ver resumen global” |

- **RLS:** Las políticas de Supabase deben reflejar estos roles:  
  - En `budget_entities`, `budget_categories` y `entity_budget_allocations`: **INSERT / UPDATE / DELETE** solo si `is_family_admin(auth.uid())` (o equivalente). **SELECT** para miembros de la familia según permisos (integrantes ven lo necesario para “Mi Presupuesto” y transacciones, no necesariamente todas las entidades/categorías del plan si se quiere restringir).  
- Integrantes **nunca** pueden modificar el plan; solo el admin puede confirmar “Confirmar y comenzar a operar” y editar montos/categorías activas.

---

## 7. Dashboard según switch

| Estado del switch | Comportamiento del dashboard |
|-------------------|-----------------------------|
| **Switch OFF** (presupuesto oficial = modelo tradicional o sin definir) | Comportamiento **actual**: métricas y tarjetas basadas en el modelo existente (family_budgets / user_budgets o lo que use hoy el dashboard). No mostrar datos del modelo entidad/categoría como fuente principal. |
| **Switch ON** (presupuesto oficial = modelo entidad/categoría) | El dashboard debe **reflejar el presupuesto del modelo nuevo**: total asignado (suma de `monthly_limit` del plan), gastado (suma de `spent_amount` o transacciones con entity/category), disponible; opcionalmente desglose por entidad o enlace a budget-overview. No mezclar con family_budgets como fuente oficial. |

- Un único flag (p. ej. `plan_status === CONFIRMED` y “switch activo”, véase §7.1) debe determinar qué lógica usa el dashboard para no tener fuentes mezcladas.

### 7.1 Activación del switch solo cuando Fase 2 esté lista

- **El switch no se activará automáticamente** al confirmar el plan (“Confirmar y comenzar a operar”). Se puede marcar `plan_status = CONFIRMED` y `setup_complete = true`, pero el **switch** que obliga a transacciones a usar entidad/categoría y que hace que el dashboard use el modelo nuevo **solo se activa cuando el módulo de transacciones (Fase 2) está desplegado**.
- **Motivo:** Si el switch se activa antes de que los formularios de “Nueva Transacción” y “Subir Ticket” tengan selectores de entidad y categoría (y validación), el usuario no podría registrar gastos y se rompería producción.
- **Implementación sugerida:** Mantener un flag o configuración (p. ej. `budget_model_active` o feature flag “transactions_entity_category_required”) que se pone en `true` **solo** al desplegar Fase 2. La lógica de “¿exijo entity/category en transacciones?” y “¿dashboard usa modelo nuevo?” depende de ese flag. Así se evita romper producción al confirmar el plan antes de tener transacciones adaptadas.

---

## 8. Resumen de validaciones y reglas (checklist)

- [ ] **Estado del plan:** `plan_status` (DRAFT / CONFIRMED). `setup_complete = true` solo si `plan_status = CONFIRMED` y resto de condiciones. Switch real = `plan_status === CONFIRMED` y Fase 2 desplegada (§7.1).
- [ ] `setup_complete` solo en true con: ≥1 PERSON activa, ≥1 GROUP activa, categorías activas, ≥1 asignación con monto > 0, plan confirmado explícitamente.
- [ ] **Versión del plan:** Un solo plan activo por periodo; editar no crea nueva versión; histórico basado en transacciones reales; no cambiar periodo activo sin cerrar (§3.1).
- [ ] No eliminar asignación con gastos; solo desactivar.
- [ ] Si nuevo monto < gastado actual → advertencia obligatoria (y confirmación o bloqueo según criterio de producto).
- [ ] Cambios en asignaciones → consolidación recalculada de inmediato.
- [ ] Transacciones sin entity_id/category_id no rompen resumen; no migración automática sin confirmación.
- [ ] **Periodo:** Fase 1 = mes calendario; trigger y API usan la misma lógica; día de corte en fases posteriores si aplica (§5).
- [ ] Solo Admin crea/edita/elimina entidades, categorías y plan; RLS actualizado.
- [ ] Dashboard: switch ON = modelo nuevo; switch OFF = comportamiento actual.
- [ ] **Activación del switch:** Solo cuando Fase 2 (transacciones adaptadas) esté desplegada; no activar solo por confirmar plan (§7.1).

---

## 9. Referencia cruzada con el plan por fases

- **Fase 1:** Incluir `plan_status` (DRAFT/CONFIRMED), validaciones de `setup_complete` (backend + front) y reglas de edición en el Paso 5 del wizard; **periodo = mes calendario** (§5); documentar selector de mes; versión única del plan (§3.1); RLS para Admin vs integrante en entidades/categorías/allocations. **No activar el switch** al confirmar; el switch se activa solo cuando Fase 2 esté desplegada.
- **Fase 2:** Al conectar transacciones (entidad + categoría obligatorios), activar el switch (feature flag o `budget_model_active`) para que dashboard y transacciones usen el modelo nuevo. Asegurar que transacciones antiguas (sin entity/category) se ignoren en resumen y no se migren sin confirmación.
- **Fase 3:** Budget-overview y selector de mes alineados a la definición de periodo (mes calendario en Fase 1; día de corte si se implementa después).
- **Fase 4:** Dashboard condicionado al switch (ON = modelo nuevo, OFF = actual); limpieza/UX de /budgets legado.

---

## Veredicto final

Con los ajustes anteriores:

- Arquitectura coherente
- Transición controlada (switch solo tras Fase 2)
- Sin romper producción (borrador vs confirmado; switch no automático)
- Permisos blindados (RLS; solo Admin modifica plan)
- Manejo de histórico claro (un plan por periodo; histórico = transacciones reales)
- Dashboard consistente con el switch
- Sin Banco Domus; sin mezclar /budgets como fuente oficial

El Task Spec queda **definitivo** para que Cursor ejecute sin deuda técnica oculta.
