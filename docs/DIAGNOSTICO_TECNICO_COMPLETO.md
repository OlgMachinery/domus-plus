# Diagnóstico técnico completo – DOMUS+

**Proyecto:** DOMUS+ (Domus Fam)  
**Estado:** Funcional en producción (domus-fam.com)  
**Fecha del diagnóstico:** 2026

---

## 1. Arquitectura actual

- **Modelo:** Monolito frontend con API routes (BFF). Sin backend independiente en uso en producción.
- **Frontend:** Next.js 14 (App Router), desplegado en Vercel. Cliente Supabase en navegador para sesión y algunas lecturas.
- **Backend lógico:** API Routes de Next.js (`/api/*`) como única capa servidor; consumen Supabase (PostgreSQL + Auth) vía `@supabase/ssr` (servidor) y `@supabase/supabase-js` (cliente).
- **Base de datos:** Supabase (PostgreSQL). RLS activo en todas las tablas públicas. Operaciones privilegiadas vía `SUPABASE_SERVICE_ROLE_KEY` en rutas concretas.
- **Flujo de datos:** Navegador → Next.js API (o Supabase directo en algunos listados) → Supabase (PostgreSQL + Auth). No hay colas, workers ni servicios asíncronos adicionales.

---

## 2. Stack exacto utilizado

| Capa | Tecnología | Versión / detalle |
|------|------------|-------------------|
| Runtime | Node.js | (Vercel) |
| Framework | Next.js | 14.0.3 (App Router) |
| Lenguaje | TypeScript | 5.3.x |
| UI | React | 18.2.x |
| Estilos | Tailwind CSS | 3.3.6 |
| Cliente HTTP | fetch nativo, axios | axios 1.6.2 |
| BBDD + Auth | Supabase | @supabase/supabase-js 2.39.x, @supabase/ssr 0.1.x |
| OCR / IA | OpenAI API | openai 4.20.x |
| Gráficos | Recharts | 2.10.3 |
| Formularios | react-hook-form | 7.49.x |
| Estado global | Zustand | 4.4.7 |
| Excel | xlsx | 0.18.5 |
| Iconos | @phosphor-icons/react | 2.1.x |
| Fuente | Plus Jakarta Sans | Google Fonts |
| Hosting | Vercel | Producción (domus-fam.com) |
| Base de datos | PostgreSQL (Supabase) | — |
| Autenticación | Supabase Auth | Email/password, JWT |

---

## 3. Estructura de carpetas

```
domus-plus/
├── frontend/                    # Aplicación Next.js
│   ├── app/
│   │   ├── api/                 # API Routes (Backend-for-Frontend)
│   │   │   ├── activity-logs/
│   │   │   ├── auth/           # login, register, login-demo
│   │   │   ├── budgets/        # family, user, summary, global-summary, annual-matrix, account
│   │   │   ├── custom-categories/
│   │   │   ├── dashboard/
│   │   │   ├── excel/, excel-import/
│   │   │   ├── families/
│   │   │   ├── personal-budgets/
│   │   │   ├── receipts/
│   │   │   ├── transactions/
│   │   │   ├── users/          # me, create, sync, verify-password, [id]
│   │   │   ├── ai-assistant/   # chat, analyze-budget, optimize-budget, etc.
│   │   │   ├── dev/            # load-test-data, clear-test-data, delete-all-transactions
│   │   │   ├── health/
│   │   │   └── whatsapp/
│   │   ├── (páginas): dashboard, login, register, family, budgets, budget-summary,
│   │   │   personal-budget, custom-categories, transactions, receipts, reports,
│   │   │   logs, excel, users, user-records, test
│   │   ├── layout.tsx
│   │   └── page.tsx            # redirect a /login
│   ├── components/             # SAPLayout, etc.
│   ├── lib/                    # supabase (client, server, middleware), api, i18n, currency, types, icons, receiptProcessing, category-defaults
│   ├── public/
│   ├── next.config.js
│   ├── package.json
│   ├── middleware.disabled.ts  # Middleware Supabase SSR (deshabilitado)
│   └── lib/supabase/middleware.ts  # updateSession (no usado como middleware activo)
├── supabase/
│   ├── schema.sql              # Esquema base y RLS/triggers iniciales
│   ├── add-is-predefined-categories.sql
│   ├── fix-rls-*.sql           # Ajustes RLS (users, family_budgets, user_budgets, etc.)
│   ├── funciones-presupuestos.sql
│   ├── trigger-usuario-automatico.sql
│   ├── flujo-crear-familia-completo.sql
│   ├── politicas-rls-receipts.sql
│   └── (otros .sql de verificación y parches)
└── docs/
    ├── FLUJO-Y-LOGICA.md
    └── DIAGNOSTICO_TECNICO_COMPLETO.md (este archivo)
```

No existe carpeta `supabase/functions/`: no hay Edge Functions en el repositorio.

**Nota:** En el repositorio puede existir una carpeta `backend/` (Python/FastAPI) de una versión anterior; en producción la aplicación usa **únicamente** las API Routes de Next.js y Supabase. Cualquier referencia a `backend/` en otros documentos es legacy.

---

## 4. Rutas principales (App Router)

| Ruta | Archivo | Propósito |
|------|---------|-----------|
| `/` | `app/page.tsx` | Redirige a `/login` |
| `/login` | `app/login/page.tsx` | Login (API + opcional Supabase); guarda `domus_token` |
| `/register` | `app/register/page.tsx` | Registro (Supabase Auth + users) |
| `/dashboard` | `app/dashboard/page.tsx` | Resumen: presupuesto mes, gastado, recibos pendientes, transacciones recientes |
| `/family` | `app/family/page.tsx` | CRUD familia y miembros (admin); dashboard integrantes |
| `/budgets` | `app/budgets/page.tsx` | Presupuestos familiares: listado, crear, editar, resumen global, matriz anual |
| `/budget-summary` | `app/budget-summary/page.tsx` | Resumen por cuenta/categoría |
| `/personal-budget` | `app/personal-budget/page.tsx` | Presupuestos personales (individuales) |
| `/custom-categories` | `app/custom-categories/page.tsx` | Categorías y subcategorías (predefinidas + personalizadas), CRUD |
| `/transactions` | `app/transactions/page.tsx` | Listar, crear, editar transacciones; opción subir recibo |
| `/receipts` | `app/receipts/page.tsx` | Listar recibos, procesar (OCR), asignar a presupuesto/transacciones |
| `/reports` | `app/reports/page.tsx` | Reportes (transacciones, presupuestos) |
| `/logs` | `app/logs/page.tsx` | Logs de actividad |
| `/excel` | `app/excel/page.tsx` | Importar presupuestos desde Excel |
| `/users` | `app/users/page.tsx` | Admin: crear usuarios (familia) |
| `/user-records` | `app/user-records/page.tsx` | Registros de usuario (ej. recibos) |
| `/test` | `app/test/page.tsx` | Página de prueba |

Todas las rutas de aplicación son **App Router** (carpeta `app/`). No hay `pages/`.

---

## 5. Middleware implementado

- **Estado:** El middleware de Next.js que refrescaba sesión Supabase está **deshabilitado**.
- **Archivos:**
  - `middleware.disabled.ts`: usa `createServerClient` de `@supabase/ssr`, refresca sesión con timeout 500 ms; matcher excluye `_next/static`, `_next/image`, `api`, assets. **No se usa** (nombre `.disabled`).
  - `lib/supabase/middleware.ts`: exporta `updateSession(request)` que crea cliente Supabase y llama `getUser()`. **No está registrado** como `middleware.ts` en la raíz.
- **Consecuencia:** No hay middleware activo; la protección de rutas y la sesión se resuelven por página (llamadas a `getSession()` / `getUser()` y redirección cliente o en API con `getAuthUser`).

---

## 6. Servicios externos conectados

| Servicio | Uso | Configuración |
|----------|-----|----------------|
| **Supabase** | BBDD PostgreSQL, Auth, RLS | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) |
| **OpenAI** | OCR de recibos (extracción de texto/ítems) | `OPENAI_API_KEY` (servidor) |
| **Vercel** | Hosting y despliegue del frontend | Vercel CLI, env en proyecto |
| **WhatsApp** (opcional) | Webhook para mensajes/recibos | `app/api/whatsapp/webhook`; configuración en env si se usa |

No hay otros servicios de pago, email transaccional, colas ni almacenamiento de objetos externo documentados en el código (Supabase Storage podría usarse para imágenes de recibos vía URL en BD).

---

## 7. Base de datos Supabase

### 7.1 Lista completa de tablas

| Tabla | Descripción |
|-------|-------------|
| `users` | Perfil extendido de Auth: id (FK auth.users), email, phone, name, is_active, is_family_admin, family_id, created_at, updated_at |
| `families` | Familias: id, name, admin_id (FK users), created_at, updated_at |
| `custom_categories` | Categorías por familia: id, family_id, name, description, icon, color, is_active, is_predefined (añadido por migración), created_at, updated_at |
| `custom_subcategories` | Subcategorías: id, custom_category_id, name, description, is_active, created_at, updated_at |
| `family_budgets` | Presupuestos familiares: id, family_id, category, subcategory, custom_category_id, custom_subcategory_id, year, total_amount, monthly_amounts (JSONB), display_names (JSONB), due_date, payment_status, notes, budget_type, distribution_method, auto_distribute, target_user_id, created_at, updated_at |
| `user_budgets` | Asignación usuario–presupuesto: id, user_id, family_budget_id, allocated_amount, spent_amount, (income_amount si existe por migración), created_at, updated_at |
| `transactions` | Movimientos: id, user_id, family_budget_id, date, amount, transaction_type, currency, merchant_or_beneficiary, category, subcategory, custom_category_id, custom_subcategory_id, concept, reference, operation_id, tracking_key, status (enum), notes, receipt_image_url, whatsapp_message_id, whatsapp_phone, created_at, updated_at |
| `receipts` | Recibos: id, user_id, image_url, whatsapp_*, date, time, amount, currency, merchant_or_beneficiary, category, subcategory, concept, reference, operation_id, tracking_key, notes, status, assigned_transaction_id, created_at, updated_at |
| `receipt_items` | Líneas de recibo: id, receipt_id, description, amount, quantity, unit_price, unit_of_measure, category, subcategory, assigned_transaction_id, notes, created_at |
| `activity_logs` | Log de acciones: id, user_id, action_type, entity_type, entity_id, description, details (JSONB), ip_address, user_agent, created_at |

Enums: `transaction_status`, `transaction_type`, `budget_type`, `distribution_method` (en schema).

### 7.2 Relaciones entre tablas

```
auth.users (Supabase)
    └── users.id (FK CASCADE)
            ├── users.family_id → families.id (SET NULL)
            ├── families.admin_id → users.id
            ├── family_budgets (por family_id)
            ├── user_budgets.user_id
            ├── transactions.user_id
            ├── receipts.user_id
            └── activity_logs.user_id

families
    ├── custom_categories.family_id (CASCADE)
    └── family_budgets.family_id (CASCADE)

custom_categories
    └── custom_subcategories.custom_category_id (CASCADE)

family_budgets
    ├── user_budgets.family_budget_id (CASCADE)
    ├── transactions.family_budget_id (SET NULL)
    ├── family_budgets.custom_category_id, custom_subcategory_id (SET NULL)
    └── family_budgets.target_user_id → users.id (SET NULL)

receipts
    ├── receipt_items.receipt_id (CASCADE)
    └── receipts.assigned_transaction_id → transactions.id (SET NULL)

transactions
    └── receipt_items.assigned_transaction_id (SET NULL)
```

### 7.3 Políticas RLS activas (referencia)

Las políticas pueden variar según los scripts `fix-rls-*.sql` aplicados. Resumen según `schema.sql` y archivos de fix:

- **users:** SELECT propio; en fixes se añade SELECT para admins sobre usuarios de su familia; INSERT/UPDATE propios; en fixes, admins pueden INSERT/UPDATE usuarios de la familia.
- **families:** SELECT si la familia es la del usuario (family_id en users).
- **family_budgets:** SELECT si family_id es de la familia del usuario; en fixes, INSERT/UPDATE/DELETE solo para `is_family_admin`.
- **user_budgets:** SELECT propio; en fixes, INSERT/UPDATE para admins.
- **transactions:** SELECT por user_id (propias).
- **receipts / receipt_items:** SELECT/INSERT/UPDATE por user_id o por receipt del usuario (politicas-rls-receipts.sql).
- **custom_categories / custom_subcategories:** SELECT por family_id del usuario; INSERT/UPDATE/DELETE según políticas de familia.
- **activity_logs:** SELECT por usuarios de la misma familia (user_id en users con mismo family_id).

Las escrituras que requieren ver otros miembros o actualizar `user_budgets`/`transactions` se hacen en API con **service role** para evitar bloqueos de RLS.

### 7.4 Triggers y funciones creadas

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| `update_updated_at_column()` | Función | Setea `NEW.updated_at = NOW()` en UPDATE. |
| `update_*_updated_at` | Trigger | BEFORE UPDATE en users, families, family_budgets, user_budgets, transactions, receipts, custom_categories, custom_subcategories. |
| `handle_new_user()` | Función | Tras INSERT en auth.users, inserta en public.users (id, email, name, phone, is_active, is_family_admin). SECURITY DEFINER. |
| `on_auth_user_created` | Trigger | AFTER INSERT ON auth.users → `handle_new_user()`. |
| `get_user_family_id(p_user_id UUID)` | Función | Devuelve family_id del usuario. Usado en políticas RLS. |
| `is_family_admin(p_user_id UUID)` | Función | Devuelve si el usuario es admin de familia. Usado en RLS. |
| `get_family_budgets_with_calculations(p_family_id, p_year)` | Función | Devuelve presupuestos familiares con user_allocations (allocated, spent, income por transacciones). SECURITY DEFINER. |
| `update_user_budget_amounts()` | Función | Trigger: en INSERT/UPDATE/DELETE de transactions actualiza spent_amount e income_amount en user_budgets (suma desde transactions). |
| `update_user_budget_amounts_trigger` | Trigger | AFTER INSERT OR UPDATE OR DELETE ON transactions → `update_user_budget_amounts()`. |
| `ensure_user_exists(...)` | Función | Crea o actualiza usuario en public.users (usado desde API login/registro). |
| `create_family`, `assign_family_admin`, `add_family_member`, `create_family_for_user` | Funciones | Lógica de creación de familia y asignación de admin/miembros (flujo-crear-familia-completo.sql). |

Nota: La columna `income_amount` en `user_budgets` no está en `schema.sql` base; existe en migraciones/backend y en funciones SQL (`update_user_budget_amounts`, `get_family_budgets_with_calculations`). Si no se ha aplicado el ALTER TABLE, las rutas que la usan pueden fallar o depender de cálculo en aplicación.

### 7.5 Edge Functions

- **No hay Edge Functions** en el repositorio (no existe `supabase/functions/`).
- Toda la lógica servidor está en Next.js API Routes (Vercel serverless).

---

## 8. Módulos implementados vs esperados

### 8.1 Estado por módulo (implementados)

| Módulo | Estado | Detalle |
|--------|--------|---------|
| **Identidad y roles** | Parcial | Auth (email/password), tabla `users` con `is_family_admin`, `is_active`. No hay roles granulares ni RBAC; solo “usuario” vs “admin familia”. |
| **Banco Domus** | No iniciado | No existe concepto de cuentas bancarias, saldos de cuenta ni conciliación. |
| **Presupuesto** | Completo | Presupuestos familiares y personales, categorías/subcategorías (predefinidas + personalizadas), asignación por usuario (user_budgets), resumen global, matriz anual, distribución. |
| **Eventos** | No iniciado | No hay entidad eventos ni calendario. |
| **Proyectos** | No iniciado | No hay entidad proyectos. |
| **Mini-proyectos** | No iniciado | No hay entidad mini-proyectos. |
| **Lista Súper** | No iniciado | No hay módulo de listas de compras / “lista súper”. |
| **Extracción de tickets** | Completo | OCR de recibos (OpenAI), guardado en `receipts` y `receipt_items`, asignación a presupuesto/transacciones. |
| **Análisis de consumo** | Parcial | Reportes y resúmenes por categoría/tiempo; AI assistant (analyze-budget, detect-anomalies, etc.) presente pero alcance limitado. |
| **Alertas o IA** | Parcial | Rutas `ai-assistant/*` (chat, analyze, optimize, report, predict, suggest-category, detect-anomalies); no hay sistema de alertas proactivas ni notificaciones. |
| **Flujo financiero real** | Parcial | Transacciones manuales y desde recibos; actualización de gastado/asignado. No hay integración bancaria ni flujo de “cuenta bancaria” (ver sección 9). |

### 8.2 Lista de módulos esperados (resumen)

- **Identidad y Roles:** Parcial (auth + admin familia).
- **Banco Domus:** No iniciado.
- **Presupuesto:** Completo.
- **Eventos:** No iniciado.
- **Proyectos:** No iniciado.
- **Mini-proyectos:** No iniciado.
- **Lista Súper:** No iniciado.
- **Extracción de tickets:** Completo.
- **Análisis de consumo:** Parcial.
- **Alertas o IA:** Parcial (IA sí, alertas no).

---

## 9. Flujo financiero real

### 9.1 Cómo se calcula el “saldo” familiar

- No existe una tabla de “cuenta familiar” ni “saldo de familia”.
- Lo que existe es:
  - **Presupuesto del mes (dashboard):** Suma de `family_budgets.total_amount` del año para la familia del usuario, dividida entre 12. No es saldo, es techo de gasto.
  - **Gastado del mes:** Suma de `transactions.amount` con `transaction_type = 'expense'` del usuario en el mes actual.
  - **Restante del mes:** `totalBudgetMonth - spentMonth` (solo para ese usuario y ese mes).
- Los “balances” por presupuesto son por `user_budgets`: `allocated_amount`, `spent_amount`, y si existe `income_amount`; “disponible” se calcula como allocated + income - spent (en resúmenes y reportes).

### 9.2 Cómo se actualizan balances

- **Al crear transacción (POST /api/transactions):** Se inserta la fila en `transactions`. Si hay `family_budget_id`, se busca el `user_budgets` del usuario para ese presupuesto y se actualiza:
  - `spent_amount += amount` (si expense) o `income_amount += amount` (si income).
- **Al editar transacción (PUT /api/transactions/[id]):** Con cliente admin se revierte el efecto del monto/presupuesto antiguo (restar de spent/income del old user_budget) y se aplica el nuevo (sumar al new user_budget).
- **Trigger en BD:** Si está creado `update_user_budget_amounts_trigger`, en INSERT/UPDATE/DELETE de `transactions` se recalculan `spent_amount` e `income_amount` en `user_budgets` como suma de transacciones. Hay riesgo de duplicar lógica con la actualización en API (doble actualización si ambos están activos).

### 9.3 Transferencias

- No hay entidad “transferencia” entre cuentas ni entre usuarios. Solo hay transacciones asociadas a un presupuesto y a un usuario. No hay flujo de “transferir de cuenta A a cuenta B”.

### 9.4 Doble validación contable

- No hay doble partida (débito/crédito). Hay un único registro por transacción y actualización de `spent_amount`/`income_amount` en `user_budgets`.
- No hay conciliación ni cuadre con movimientos bancarios.
- La consistencia se basa en: trigger en `transactions` que recalcula desde la tabla de transacciones, o en la actualización explícita en API; si ambos están aplicados, puede haber redundancia o desfase si uno falla.

---

## 10. Seguridad

### 10.1 Autenticación

- Supabase Auth (email/password). Login vía `POST /api/auth/login` (signInWithPassword) y opcionalmente cookies; el frontend guarda `access_token` en `localStorage` como `domus_token`.
- Las API routes obtienen el usuario por: header `Authorization: Bearer <token>` (prioritario) o cookies de sesión Supabase (`createClient(request)`).
- Patrón repetido: `getAuthUser(supabase, request)` que prueba token Bearer y luego `supabase.auth.getUser()`.
- No hay 2FA, magic link ni proveedores OAuth en el código actual.

### 10.2 Autorización por familia

- **Lectura:** RLS limita por `family_id` (usuario debe pertenecer a la familia). Para listar miembros de la familia, `GET /api/families` usa **service role** cuando el usuario es `is_family_admin` para poder leer todos los `users` de la familia.
- **Escritura:** Solo `is_family_admin` puede crear/editar/eliminar familia, crear presupuestos familiares, crear usuarios (invitar), editar/eliminar miembros. Se valida en API (comprobando `users.is_family_admin`) y en algunas políticas RLS (INSERT/UPDATE/DELETE en family_budgets, user_budgets, users).
- **Transacciones:** Cada usuario solo puede ver/crear/editar sus propias transacciones (user_id = auth.uid()); el presupuesto asociado se valida que sea de su familia.

### 10.3 Riesgos detectados

- **Middleware deshabilitado:** No se refresca la sesión en cada request; si el token expira, el usuario puede seguir en la app hasta que una llamada falle (401).
- **Token en localStorage:** Vulnerable a XSS; un script inyectado podría robar `domus_token`.
- **Service role en API:** Varias rutas usan `SUPABASE_SERVICE_ROLE_KEY`; si hay fuga de código o de logs, el impacto es total sobre el proyecto Supabase.
- **Validación de entrada:** Hay validaciones básicas (monto > 0, límite 1e9) pero no esquemas centralizados (p. ej. Zod) en todas las rutas; riesgo de tipos inesperados o inyección en JSONB.
- **Sin rate limiting:** Las API routes no implementan límite de tasa; riesgo de abuso o fuerza bruta en login.
- **Políticas RLS dispersas:** Múltiples scripts fix-rls-*.sql; el estado real de RLS depende del orden de ejecución y puede haber políticas duplicadas o contradictorias si no se unifican.

---

## 11. Métricas

### 11.1 Indicadores existentes

- **Dashboard:** Presupuesto del mes (agregado por familia/año), gastado del mes (transacciones expense del usuario), restante del mes, cantidad de recibos pendientes, últimas 10 transacciones.
- **Presupuestos:** Resumen por cuenta (total_amount, pagado, restante, estado), matriz anual (totales por concepto y mes).
- **Reportes:** Agregados por categoría/transacciones; uso de `allocated_amount`, `spent_amount`, `income_amount` en resúmenes.
- **AI assistant:** Análisis de presupuesto, detección de anomalías, predicción de gastos, sugerencia de categoría (indicadores derivados en tiempo de request, no persistidos).

### 11.2 Dashboards activos

- **Dashboard principal (`/dashboard`):** Tarjetas de presupuesto mes, gastado, restante, recibos pendientes y lista de transacciones recientes.
- **Resumen global y matriz anual (`/budgets`):** Resumen global por año y matriz concepto × mes.
- **Resumen por cuenta (`/budget-summary`):** Por cuenta/categoría con total, pagado, restante.
- **Reportes (`/reports`):** Página de reportes con datos de transacciones y presupuestos.

No hay dashboard de operaciones, errores ni métricas de uso (analytics) implementados en el código.

---

## 12. Deuda técnica

### 12.1 Código repetido

- **Obtención de token/headers:** Cada página define su propia forma de `backendUrl`, `apiBase`, `getToken()` o `getAuthHeaders()` (localStorage + Supabase session). Aparece en: budgets, custom-categories, receipts, family, reports, logs, personal-budget, user-records, transactions, budget-summary, dashboard, SAPLayout, login. Debería centralizarse en un solo módulo (ej. `lib/auth.ts` o `lib/api.ts`).
- **getAuthUser en API:** Casi todas las rutas repiten el mismo patrón (Bearer token + fallback a getUser()). Debería ser un helper único reutilizado en todas las rutas.
- **Validación de body:** Comprobaciones ad hoc (amount > 0, amount < 1e9, required fields); sin esquema compartido (Zod/Yup) ni DTOs por recurso.
- **Mensajes de error:** Strings en español/inglés mezclados en código; no hay capa de i18n en API.

### 12.2 Falta de validaciones

- Longitud y formato de nombres, descripciones, conceptos (riesgo de almacenar strings muy grandes o con caracteres problemáticos).
- Fechas: no hay validación estricta de rangos (p. ej. fecha de transacción no futura si la lógica de negocio lo exige).
- Relaciones: en algunos POST no se comprueba que `family_budget_id` exista y pertenezca a la familia antes de usarlo (en transactions sí se hace; en otros endpoints puede faltar).
- Categorías/subcategorías: a veces se envían como texto libre sin validar contra `custom_categories`/subcategorías.

### 12.3 Campos que deberían normalizarse

- **Moneda:** `currency` en transactions/receipts es string (ej. 'MXN'); no hay tabla de monedas ni conversión. Consistente pero sin normalización.
- **category/subcategory:** En `family_budgets`, `transactions`, `receipts` se guardan como VARCHAR; también existen `custom_category_id` y `custom_subcategory_id`. Uso dual (texto vs FK) puede generar inconsistencias; convendría decidir si todo va por IDs o por nombres y unificar.
- **phone en users:** UNIQUE; en registro puede quedar vacío o repetido si no se valida bien.
- **Nombres de categorías:** Predefinidas sembradas por familia; si se renombra una categoría, los presupuestos/transacciones que usan el nombre viejo no se actualizan (no hay FK por nombre).

### 12.4 Problemas estructurales

- **Sin capa de servicio:** La lógica de negocio (cálculo de gastado, actualización de user_budgets, creación de transacción + log) está dentro de las API routes; difícil de reutilizar y de testear.
- **Mezcla de cliente Supabase y API:** Algunas páginas leen directo de Supabase (p. ej. family_budgets) y otras solo vía API; comportamiento y permisos pueden divergir.
- **RLS + service role:** El uso de admin client en varias rutas evita RLS pero la autorización se hace a mano en código; si se olvida una comprobación, hay riesgo de escalación de privilegios.
- **Scripts SQL dispersos:** Muchos archivos en `supabase/*.sql` sin un único “estado objetivo” del esquema y RLS; migraciones no versionadas (no hay numeración tipo 001_, 002_).
- **Trigger vs API:** Tanto el trigger `update_user_budget_amounts` como la actualización en POST/PUT de transactions modifican `user_budgets`; conviene un solo origen de verdad (solo trigger o solo API) para evitar desfases.
- **income_amount:** Referenciado en código y en funciones SQL pero no en schema.sql base; depende de migración o ALTER TABLE aplicado a mano.

---

## 13. Resumen ejecutivo

| Área | Estado | Prioridad sugerida |
|------|--------|--------------------|
| Arquitectura | Monolito Next.js + Supabase, claro | — |
| Stack | Actual y adecuado para el alcance | — |
| Rutas y API | Completas para presupuestos, transacciones, recibos, familias, categorías | — |
| Middleware | Deshabilitado; sin protección centralizada de rutas | Alta |
| BBDD | Esquema definido; RLS y funciones en varios scripts; income_amount opcional | Media (unificar RLS y migraciones) |
| Módulos esperados | Presupuesto y tickets completos; Banco Domus, Eventos, Proyectos, Lista Súper no iniciados; IA/alertas parciales | Según roadmap producto |
| Flujo financiero | Sin “banco” ni saldo familiar; balances por presupuesto y usuario; sin doble partida | Media si se quiere modelo contable más estricto |
| Seguridad | Auth y familia correctos en general; token en localStorage, sin rate limit, RLS fragmentado | Alta (token, rate limit, unificar RLS) |
| Métricas | Solo dashboards de negocio; sin observabilidad ni alertas técnicas | Baja/media |
| Deuda técnica | Código repetido (auth/token), validaciones ad hoc, normalización de categorías y origen de actualización de balances | Alta (centralizar auth y validación); media (esquema y triggers) |

Este documento debe tratarse como referencia técnica viva; conviene actualizarlo al aplicar cambios en esquema, RLS, módulos o seguridad.
