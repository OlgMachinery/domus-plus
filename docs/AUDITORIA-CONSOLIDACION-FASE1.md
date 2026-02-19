# Auditoría y consolidación – Fase 1

**Objetivo:** Análisis técnico para consolidar el modelo de presupuestos y transacciones, centralizar auth y planear validación estructurada.  
**Alcance:** Solo diagnóstico; no se implementan cambios.

---

## 1️⃣ Uso real de `personal_budgets`

### Búsqueda en todo el repositorio

**Cadena "personal_budgets" (tabla / concepto):**

| Archivo | Uso |
|---------|-----|
| `docs/FLUJO-Y-LOGICA.md` | Referencia al flujo "PersonalBudget" → `/personal-budget` y APIs de presupuestos. |
| `frontend/app/personal-budget/page.tsx` | Interfaz `PersonalBudget` (tipo TS), estado `budgets: PersonalBudget[]`; **no** referencia la tabla `personal_budgets`. |
| `frontend/app/api/personal-budgets/route.ts` | GET/POST leen/escriben **`family_budgets`** (filtro `budget_type='individual'`, `target_user_id=authUser.id`) y **`user_budgets`**. **No usan la tabla `personal_budgets`.** |
| `frontend/app/api/personal-budgets/[id]/route.ts` | GET/PUT/DELETE sobre **`family_budgets`** y **`user_budgets`**. **No usan la tabla `personal_budgets`.** |
| `frontend/app/api/personal-budgets/categories/route.ts` | Devuelve categorías estáticas en código. No toca BD. |
| `backend/app/main.py` | Incluye router `personal_budgets` (módulo Python). |
| `backend/app/routers/personal_budgets.py` | Funciones `get_personal_budgets`, `create_personal_budget`, etc. Consultan **`models.FamilyBudget`** y **`models.UserBudget`** (tablas `family_budgets` y `user_budgets`). **No usan la tabla `personal_budgets`.** |

**Cadena "PersonalBudget" (tipo/entidad):**

- Solo en `frontend/app/personal-budget/page.tsx` como interfaz TypeScript local.

**Endpoints que usan el concepto “presupuesto personal”:**

- `GET /api/personal-budgets` → `family_budgets` + `user_budgets`
- `POST /api/personal-budgets` → insert en `family_budgets` + `user_budgets`
- `GET /api/personal-budgets/categories` → respuesta estática
- `GET/PUT/DELETE /api/personal-budgets/[id]` → `family_budgets` + `user_budgets`

**Consultas SQL / Supabase que mencionan "personal_budgets":**

- **Ninguna.** En frontend y backend las consultas son a `family_budgets` y `user_budgets`.

**Pantallas que lo usan:**

- **`/personal-budget`** (`frontend/app/personal-budget/page.tsx`): llama a `/api/personal-budgets` y `/api/personal-budgets/categories`; trabaja con datos que vienen de `family_budgets` + `user_budgets`.

### Resumen por pregunta

- **Lista exacta de archivos donde aparece "personal_budgets" o "PersonalBudget":**  
  `docs/FLUJO-Y-LOGICA.md`, `frontend/app/personal-budget/page.tsx`, `frontend/app/api/personal-budgets/route.ts`, `frontend/app/api/personal-budgets/[id]/route.ts`, `frontend/app/api/personal-budgets/categories/route.ts`, `backend/app/main.py`, `backend/app/routers/personal_budgets.py`.
- **Funciones que consumen el concepto:**  
  En frontend: `loadBudgets`, `loadCategories`, `handleCreateBudget`, `handleUpdateBudget`, `handleDeleteBudget` (página personal-budget). En API: GET/POST de `personal-budgets/route.ts`, GET/PUT/DELETE de `personal-budgets/[id]/route.ts`. En backend Python: `get_personal_budgets`, `create_personal_budget`, `get_personal_budget`, `update_personal_budget`, `delete_personal_budget` (todas sobre FamilyBudget/UserBudget).
- **¿Afecta cálculos de dashboard?**  
  **No.** El dashboard usa `/api/dashboard/stats`, que lee `family_budgets` (por `family_id`) y `transactions`; no usa la ruta `/api/personal-budgets` ni la tabla `personal_budgets`.
- **¿Afecta reportes?**  
  **No.** Reportes usan transacciones y presupuestos vía otras APIs; no referencian `personal_budgets` ni las rutas de personal-budgets para agregados.
- **¿Afecta transacciones?**  
  **No.** Las transacciones se asocian a `family_budget_id` (tabla `family_budgets`); no hay FK a `personal_budgets`.

### Conclusión 1: ¿Es núcleo o redundante?

- **La tabla `personal_budgets` en Supabase es redundante** para el flujo actual.
- Toda la lógica de “presupuesto personal” en frontend y en backend (Next.js y Python) usa:
  - **`family_budgets`** con `budget_type = 'individual'` y `target_user_id = user_id`
  - **`user_budgets`** para la asignación del usuario al presupuesto.
- Ningún código del repositorio lee ni escribe la tabla `personal_budgets`. Es candidata a eliminación tras verificar que no existan otros consumidores (por ejemplo, reportes o integraciones externas) y, si se desea, documentar o migrar datos antes de borrarla.

---

## 2️⃣ Origen único de verdad de `spent_amount`

### A) ¿La API modifica `spent_amount` manualmente?

**Sí.**

- **POST /api/transactions** (`frontend/app/api/transactions/route.ts`):  
  Tras insertar la transacción, si hay `family_budget_id` busca el `user_budgets` del usuario para ese presupuesto y hace:
  - `income_amount += body.amount` si `transaction_type === 'income'`
  - `spent_amount += body.amount` si no (expense).
- **PUT /api/transactions/[id]** (`frontend/app/api/transactions/[id]/route.ts`):  
  - Resta el monto antiguo del `user_budgets` antiguo (`spent_amount` o `income_amount`).
  - Suma el monto nuevo al `user_budgets` nuevo.
  - Usa cliente admin (service role) para leer y actualizar `user_budgets`.

**DELETE /api/transactions/[id]:**  
- **No existe.** No hay handler `DELETE` en `frontend/app/api/transactions/[id]/route.ts`. Solo GET y PUT.

### B) ¿Existe trigger en producción que recalcula `spent_amount`?

**Sí, en el código de esquema/migración.**

- **Archivo:** `supabase/funciones-presupuestos.sql`
- **Función:** `update_user_budget_amounts()`
- **Trigger:** `update_user_budget_amounts_trigger`  
  - `AFTER INSERT OR UPDATE OR DELETE ON transactions`  
  - Para cada fila afectada, recalcula `spent_amount` e `income_amount` en `user_budgets` como suma de `transactions` (por `family_budget_id`, `user_id` y `transaction_type`).

Si este script se ha ejecutado en la base real, el trigger está activo en producción.

### C) ¿Ambos están activos?

**Sí.** Si el trigger está aplicado en la BD:

1. **INSERT:** La API suma a `spent_amount`/`income_amount`; el trigger vuelve a calcular desde `SUM(transactions)`. Resultado: el valor queda correcto pero se escribe dos veces (redundante).
2. **UPDATE:** La API resta en el presupuesto viejo y suma en el nuevo; el trigger también recalcula en ambos. Mismo efecto, doble escritura.
3. **DELETE:** No hay DELETE en la API; si en el futuro se añade, el trigger ya recalcula tras DELETE, por lo que la API no debería tocar `spent_amount`/`income_amount` en ese caso.

Riesgo: si en algún momento la API y el trigger no coinciden (p. ej. tipo de transacción, redondeos o errores), puede haber desfase hasta el siguiente recálculo por trigger.

### Conclusión 2: Propuesta para un solo origen de verdad

**Opción recomendada: trigger como único origen.**

1. **Dejar solo el trigger** para mantener `spent_amount` e `income_amount` en `user_budgets`:
   - Asegurar que `update_user_budget_amounts_trigger` esté creado y activo en producción (script `funciones-presupuestos.sql`).
   - En **POST /api/transactions** y **PUT /api/transactions/[id]**: eliminar todo el bloque que lee `user_budgets` y hace `update` de `spent_amount`/`income_amount`. Solo insertar/actualizar la fila en `transactions`; el trigger actualizará `user_budgets`.
2. **Ventajas:** Un solo lugar que define el cálculo; consistencia ante INSERT/UPDATE/DELETE; menos código en la API.
3. **Consideración:** La respuesta de la API ya no “actualiza” explícitamente los totales; los clientes que necesiten el valor al instante pueden leer `user_budgets` tras la operación o confiar en el siguiente refresh.

**Opción alternativa: solo API.**

- Eliminar el trigger y mantener toda la lógica en la API. Requeriría implementar DELETE en la API y allí restar del `user_budgets` correspondiente. Más lógica en aplicación y riesgo de olvidar algún caso (p. ej. DELETE).

Se recomienda la opción del **trigger como único origen** y API sin tocar `spent_amount`/`income_amount`.

---

## 3️⃣ Consolidación del modelo presupuestario

### Relación entre tablas

- **family_budgets:** Presupuesto por familia (año, categoría, subcategoría, tipo compartido/individual, `target_user_id` si es individual, etc.).
- **user_budgets:** Asignación de un usuario a un presupuesto familiar (`user_id`, `family_budget_id`, `allocated_amount`, `spent_amount`, y si existe `income_amount`).
- **personal_budgets (tabla en BD):** En el código **no se usa**. La funcionalidad “presupuesto personal” se implementa con `family_budgets` (budget_type = 'individual', target_user_id = usuario) + una fila en `user_budgets`.

### ¿Hay duplicidad funcional?

- **Sí, a nivel de concepto:**  
  La tabla `personal_budgets` en la base parece pensada para “presupuestos personales”, pero la aplicación ya modela eso con `family_budgets` + `user_budgets`. Por tanto hay duplicidad de **modelo** (tabla no usada vs modelo usado).
- **Entre family_budgets y user_budgets no hay duplicidad:** Son complementarios (cabecera vs asignación por usuario).

### ¿Se puede eliminar `personal_budgets` sin romper nada?

- **En el código actual: sí.** Ningún archivo del repositorio referencia la tabla `personal_budgets`. Eliminarla no rompe frontend ni API routes de Next.js ni los routers del backend Python que hemos revisado.
- **Precaución:** Confirmar en la BD que no existan vistas, funciones, triggers o jobs que usen `personal_budgets` antes de borrarla.

### ¿Qué migración sería necesaria?

1. **Comprobar** que no haya filas en `personal_budgets` que deban conservarse; si las hubiera y se quisiera mantener el historico, habría que:
   - Definir equivalencia con `family_budgets` + `user_budgets` (por ejemplo por usuario, categoría, año).
   - Insertar en `family_budgets`/`user_budgets` y luego migrar referencias si las hubiera.
2. **Eliminar dependencias:** vistas, funciones, triggers que referencien `personal_budgets`.
3. **DROP TABLE personal_budgets** (y secuencias/permisos asociados si aplica).
4. **Documentar** en el proyecto que “presupuesto personal” = `family_budgets` (individual) + `user_budgets`.

No se implementan cambios; solo se deja planificado.

---

## 4️⃣ Centralización de autenticación

### Implementaciones encontradas

**getToken / getAuthHeaders / domus_token:**

| Archivo | Implementación |
|---------|----------------|
| `frontend/app/budgets/page.tsx` | `getAuthHeaders` async: session → localStorage `domus_token`; fallback `localStorage.getItem('domus_token')`. Usa `domus_token` en varias llamadas. |
| `frontend/app/custom-categories/page.tsx` | `getToken()`: `localStorage.getItem('domus_token')`. Uso en loadCategories, create, update, delete. |
| `frontend/app/receipts/page.tsx` | `getToken()` sync; `getAuthToken()` async (session → guarda en `domus_token` → fallback localStorage). Varias llamadas con token. |
| `frontend/app/family/page.tsx` | `getAuthHeaders` async: session → `domus_token`; fallback localStorage. |
| `frontend/app/reports/page.tsx` | `getToken()`: `localStorage.getItem('domus_token')`. |
| `frontend/app/logs/page.tsx` | `getToken()`: `localStorage.getItem('domus_token')`. |
| `frontend/app/personal-budget/page.tsx` | `getToken()`: `localStorage.getItem('domus_token')`. |
| `frontend/app/user-records/page.tsx` | Uso directo `localStorage.getItem('domus_token')`. |
| `frontend/app/transactions/page.tsx` | `getAuthHeaders()` sync: solo `localStorage.getItem('domus_token')`; uso directo de `domus_token` en varios fetches. |
| `frontend/app/budget-summary/page.tsx` | `getToken()`: `localStorage.getItem('domus_token')`. |
| `frontend/app/dashboard/page.tsx` | Uso directo `localStorage.getItem('domus_token')` y comprobación `!!localStorage.getItem('domus_token')`. |
| `frontend/components/SAPLayout.tsx` | `localStorage.removeItem('domus_token')` (logout). |
| `frontend/app/login/page.tsx` | `localStorage.setItem('domus_token', token)` tras login. |
| `frontend/lib/api.ts` | Interceptor: `localStorage.getItem('domus_token')`; lógica para no pisar token. |

### Propuesta: un único helper en `lib/auth.ts`

**Objetivo:** Un solo lugar para obtener token/headers y para escribir/borrar `domus_token`.

**Contenido sugerido de `lib/auth.ts`:**

- **getToken(): string | null**  
  - Devuelve `localStorage.getItem('domus_token')` si está en cliente; si no, `null`.  
  - (Opcional) intentar antes `supabase.auth.getSession()` y, si hay `session.access_token`, guardarlo en `domus_token` y devolverlo, para que el token se refresque desde sesión cuando exista.

- **getAuthToken(): Promise<string | null>**  
  - Prioridad: `supabase.auth.getSession()` → si hay `access_token`, guardarlo en `domus_token` y devolverlo.  
  - Fallback: `localStorage.getItem('domus_token')`.  
  - Útil para llamadas que deben usar el token más reciente (p. ej. después de refresh).

- **getAuthHeaders(): Promise<HeadersInit | undefined>**  
  - Usar `getAuthToken()` (o `getToken()` si se prefiere síncrono) y devolver `{ Authorization: 'Bearer ' + token }` si hay token; si no, `undefined`.

- **setAuthToken(token: string): void**  
  - `localStorage.setItem('domus_token', token)`. Usar desde login (y desde cualquier flujo que reciba token).

- **clearAuthToken(): void**  
  - `localStorage.removeItem('domus_token')`. Usar en logout (p. ej. en SAPLayout y en cualquier cierre de sesión).

**Eliminación de duplicidad:**

- Reemplazar en todas las páginas y componentes:
  - Cualquier `getToken` local por import de `getToken` o `getAuthToken` desde `@/lib/auth`.
  - Cualquier `getAuthHeaders` local por `getAuthHeaders` de `@/lib/auth`.
  - Lecturas/escrituras directas a `localStorage['domus_token']` por `getToken`/`getAuthToken`/`setAuthToken`/`clearAuthToken`.
- Mantener un solo criterio: si se quiere priorizar sesión reciente, usar `getAuthToken`/`getAuthHeaders` async; si solo se quiere rápido y síncrono, usar `getToken` y en `getAuthHeaders` devolver headers a partir de ese valor.
- En `lib/api.ts`, usar el helper de `lib/auth` para leer/actualizar token en lugar de tocar `localStorage` directamente.

Con esto se centraliza autenticación y se facilita un único punto para futuros cambios (ej. refresh, otro storage).

---

## 5️⃣ Validación estructurada (plan con Zod)

### Estado actual en API routes

- **Validaciones manuales repetidas:**
  - Monto: `!body.amount || body.amount <= 0`, `body.amount > 1000000000` (transactions, budgets, personal-budgets, receipts/items).
  - Año: rango `currentYear - 1` a `currentYear + 1` en personal-budgets.
  - Nombre: `!body.name || !body.name.trim()` en custom-categories, users, receipts/items.
  - Email/phone: trim y comprobaciones ad hoc en users/create y auth/register.
- **Campos sin validar o poco validados:**
  - transactions: `date`, `transaction_type` (enum), `currency`, longitudes de `concept`, `merchant_or_beneficiary`, etc.
  - budgets: `category`, `subcategory`, `frequency`, `monthly_amounts` (estructura), etc.
  - receipts: estructura de items (name, amount, quantity), tipos de archivo, tamaño.
  - users: formato email, longitud de name/phone, `is_active`/`is_family_admin` como boolean.
- **Lugares donde falta validación:** Varios bodies se usan con `body.campo || null` sin comprobar tipo; algunos IDs de ruta se usan con `parseInt` sin comprobar NaN o negativos.

### Plan estructural con Zod (sin implementar)

**Ubicación sugerida:** `frontend/lib/validations/` (o `shared/validations` si luego se usa en servidor).

**Esquemas propuestos:**

1. **transactions**
   - **TransactionCreate:** amount (number, positive, max 1e9), date (string ISO o Date), transaction_type (enum 'income'|'expense'), currency (string opcional), family_budget_id (number entero positivo opcional), merchant_or_beneficiary, category, subcategory, concept, reference, notes (strings con longitud máxima opcional). Opcional: custom_category_id, custom_subcategory_id.
   - **TransactionUpdate:** mismos campos como opcionales (partial); amount si existe debe ser positivo y ≤ 1e9.

2. **budgets**
   - **FamilyBudgetCreate:** category, subcategory (strings), year (número en rango), total_amount (positive, max 1e9), budget_type (enum), distribution_method, frequency, etc. Opcional: custom_category_id, custom_subcategory_id, monthly_amounts (objeto o JSON).
   - **FamilyBudgetUpdate:** partial de lo anterior.
   - **PersonalBudgetCreate:** subconjunto (category, subcategory, year, total_amount) más restricciones de año y monto.
   - **UserBudgetCreate/Update:** family_budget_id (number), allocated_amount (positive).

3. **receipts**
   - **ReceiptProcess (body multipart):** validar que haya archivo(s) imagen; opcional: amount, merchant, date como campos de formulario.
   - **ReceiptItemCreate:** name (string no vacío), amount (positive), quantity/unit_price opcionales numéricos.
   - **ReceiptAssign:** family_budget_id, opcionalmente user_id(s) o assign_to_all (boolean).

4. **users**
   - **UserCreate:** email (email válido), name (string, min/max length), phone (string opcional, formato opcional).
   - **UserUpdate:** name, phone, is_active, is_family_admin (todos opcionales, tipos correctos).

**Uso en rutas:**

- En cada POST/PUT: `const body = Schema.parse(await request.json())` (o `parse` con safeParse y devolver 400 con errores de Zod). Para IDs de ruta: esquema con `z.coerce.number().int().positive()`.
- No implementar aún; solo dejar definidos los nombres de esquemas y los campos a validar como arriba para que la implementación sea directa.

**Resumen:** Un módulo por dominio (transactions, budgets, receipts, users) con esquemas Zod exportados; las rutas en una segunda fase importan y usan `.parse()` o `.safeParse()` y dejan de repetir validaciones manuales.

---

## Resumen ejecutivo

| Tema | Conclusión |
|------|------------|
| **personal_budgets** | Tabla no usada en el código. Presupuesto personal = `family_budgets` (individual) + `user_budgets`. Se puede eliminar la tabla tras verificar que no haya otros usos. |
| **spent_amount** | API y trigger actualizan lo mismo; doble origen. Propuesta: dejar solo el trigger y quitar actualización manual en POST/PUT de transactions. |
| **Consolidación presupuestos** | Sin duplicidad entre family_budgets y user_budgets. personal_budgets es redundante; migración = verificar dependencias y DROP. |
| **Auth** | Múltiples implementaciones de getToken/getAuthHeaders y uso directo de domus_token. Propuesta: un solo `lib/auth.ts` con getToken, getAuthToken, getAuthHeaders, setAuthToken, clearAuthToken y reemplazar todo lo demás. |
| **Validación** | Mucha validación manual y campos sin validar. Plan: esquemas Zod para transactions, budgets, receipts, users y usarlos en API routes sin implementar aún. |

Este documento es solo diagnóstico y plan; no incluye cambios de código ni de base de datos.
