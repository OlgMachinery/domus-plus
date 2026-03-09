# Prueba manual Fase 1 — Setup Wizard

Guía para probar el Setup Wizard en entorno real sin avanzar a Fase 2.

---

## 1. Confirmación de compilación

- **Build:** `npm run build` en `frontend/` termina correctamente (sin errores de compilación).
- Las rutas `/setup`, `/api/setup/*` están incluidas en el build.

---

## 2. Migraciones en Supabase

Debes tener aplicadas **en este orden**:

1. **`20250219_budget_entities_and_categories.sql`**  
   Crea: `get_user_family_id`, tablas `budget_entities`, `budget_categories`, `entity_budget_allocations`, columnas en `transactions`, trigger, RLS de “view” para esas tablas.

2. **`20250220_setup_wizard_fase1.sql`**  
   Añade: columnas en `families` (currency, cutoff_day, budget_start_date, setup_complete, plan_status), columnas en `users` (can_register_expenses, etc.), tipo FAMILY en budget_categories, `is_family_admin`, `can_set_setup_complete`, RLS “Admin can manage” en entities/categories/allocations.

**Cómo aplicar:**

- **Opción A — Supabase Dashboard**  
  - Ir a **SQL Editor**.  
  - Copiar y ejecutar el contenido de `supabase/migrations/20250219_budget_entities_and_categories.sql`.  
  - Luego copiar y ejecutar el contenido de `supabase/migrations/20250220_setup_wizard_fase1.sql`.

- **Opción B — Supabase CLI**  
  - Desde la raíz del repo: `supabase db push` (o `supabase migration up` según tu configuración).

**Verificación:**

- En **SQL Editor** ejecuta el script **`supabase/verificar_fase1_setup.sql`**.
- Debe aparecer el mensaje: `OK Fase 1: familias, users, budget_categories (FAMILY), can_set_setup_complete y RLS verificados.`
- La consulta final debe listar columnas en `families`, `users` y las tres funciones.

Si algo falla, el script indica qué falta; aplica la migración correspondiente.

**Paso 1 (Crear familia):** La API usa la función **`create_family_for_user(p_user_id, p_family_name)`**. Si no existe en tu BD, el Paso 1 fallará al crear la familia. En ese caso ejecuta en SQL Editor el script **`supabase/funcion-crear-familia-auto.sql`** (o la función equivalente en `supabase/flujo-crear-familia-completo.sql`).

**Paso 2 (Integrantes) y columna faltante:** Si la BD no tiene las columnas de permisos en `users` (porque el proyecto no se creó desde cero en Supabase), puede aparecer *"Could not find the 'can_create_events' column"*. Ejecuta en SQL Editor **`supabase/sync-users-columns.sql`** para añadir `can_register_expenses`, `can_upload_receipts`, `can_create_events`, `can_view_global_summary`. Ver también **`docs/NOTA_SUPABASE_DB.md`**.

---

## 3. Variables de entorno

En `frontend/.env.local` (o el archivo que use tu entorno) debe haber:

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (obligatoria). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (obligatoria para login y APIs). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (obligatoria para **Paso 2**: crear integrantes desde el wizard; sin ella no se pueden crear usuarios nuevos). |

Opcional (según tu proyecto):

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — si usas este nombre en lugar de ANON_KEY en algún sitio.

**Dónde verlas en Supabase:** Project Settings → API → Project URL, `anon` key y `service_role` key.

---

## 4. URL para probar

Con el servidor local:

```bash
cd frontend && npm run dev
```

- **Entrada recomendada:**  
  **http://localhost:3000/dashboard**

- **Comportamiento esperado:**  
  - Si no tienes `family_id` → redirección a **http://localhost:3000/setup** (Paso 1).  
  - Si tienes `family_id` y eres admin y `setup_complete = false` → redirección a **http://localhost:3000/setup**.  
  - Si `setup_complete = true` → ves el dashboard con normalidad.

- **Acceso directo al wizard:**  
  **http://localhost:3000/setup**  
  (sirve si ya estás logueado; si no, te llevará a login).

---

## 5. Usuario de prueba

No se crea ningún usuario automáticamente. Opciones:

**A) Usar un usuario existente**

- Si ya tienes un usuario en Supabase Auth y en `public.users`:
  - En la tabla `users`, asígnale `is_family_admin = true`.
  - Para probar el gate “sin familia”: pon `family_id = NULL`.
  - Entra con ese usuario en **http://localhost:3000/login** y luego ve a **http://localhost:3000/dashboard**; debe redirigir a `/setup`.

**B) Crear usuario nuevo para la prueba**

1. Ir a **http://localhost:3000/register** y registrarte (email + contraseña + nombre, etc.). El registro **confirma el email automáticamente** si está configurado `SUPABASE_SERVICE_ROLE_KEY`, así que podrás hacer login sin tocar el panel.
2. (Opcional) Si quieres que sea admin: en Supabase SQL Editor ejecutar (sustituir el UUID por el `id` del usuario):

```sql
UPDATE public.users
SET is_family_admin = true, family_id = NULL
WHERE id = 'TU-USER-UUID-AQUI';
```

3. Entrar en **http://localhost:3000/login** con ese email y contraseña.
4. Ir a **http://localhost:3000/dashboard** → debe redirigir a **http://localhost:3000/setup** (Paso 1) si no tienes familia.

**C) Usuario admin de prueba sin tocar el panel de Supabase**

Con el servidor en marcha (`npm run dev`), en desarrollo o con `ALLOW_SEED_TEST_USER=true`:

```bash
curl -X POST http://localhost:3000/api/auth/seed-test-user
```

Eso crea (o actualiza) un usuario en Auth y en `public.users` con **email:** `admin@domus.local`, **contraseña:** `Admin123!`, **is_family_admin:** true. Luego entra en **http://localhost:3000/login** con esas credenciales.

---

## 6. Pasos antes de probar

1. Aplicar las dos migraciones en Supabase (y ejecutar `verificar_fase1_setup.sql`).
2. Configurar `.env.local` en `frontend/` con las tres variables de Supabase.
3. Tener al menos un usuario en `public.users` con `is_family_admin = true` y, si quieres probar el gate, `family_id = NULL`.
4. Levantar el frontend: `cd frontend && npm run dev`.
5. Abrir **http://localhost:3000/login**, iniciar sesión y luego **http://localhost:3000/dashboard** (o ir directo a **http://localhost:3000/setup** si ya estás logueado).

---

## 7. Checklist de prueba del wizard

- **Gate:** Usuario sin familia → al entrar a `/dashboard` redirige a `/setup`. No debe haber loop (si redirige a setup y setup carga bien, está correcto).
- **Paso 1:** Completar nombre, moneda, día de corte, fecha inicio → “Crear familia y continuar”. Debe guardar y pasar al Paso 2.
- **Paso 2:** Agregar al menos un integrante (nombre, email, contraseña, permisos) → “Guardar integrante”. Luego “Continuar”. (Requiere `SUPABASE_SERVICE_ROLE_KEY` para crear el usuario.)
- **Paso 3:** Crear al menos una entidad PERSON y una GROUP (ej. “Yo”, “Hogar”) → “Continuar”.
- **Paso 4:** Crear al menos una categoría (tipo PERSONAL, ASSET, FAMILY o GLOBAL) → “Continuar”.
- **Paso 5:** Activar categorías por entidad y poner al menos un monto > 0 → “Guardar plan (borrador)”. Luego “Confirmar y comenzar a operar” (modal de confirmación) → debe marcar `setup_complete = true` y `plan_status = 'CONFIRMED'` en la tabla `families`.
- **Dashboard:** Con `setup_complete = true`, entrar a **http://localhost:3000/dashboard** debe mostrar el dashboard sin redirigir a `/setup`.
- **Indicador:** En el header (si eres admin) debe verse “Setup completo” o “Configuración incompleta” según el estado.

---

## 8. Comprobar setup_complete en BD

En Supabase SQL Editor:

```sql
SELECT id, name, setup_complete, plan_status
FROM public.families
WHERE id = TU_FAMILY_ID;
```

Tras confirmar el plan en el Paso 5, debe verse `setup_complete = true` y `plan_status = 'CONFIRMED'`.

---

## 9. Resumen final

| Item | Estado |
|------|--------|
| Compilación | OK (`npm run build` sin errores). |
| Migraciones | Aplicar 20250219 y 20250220; verificar con `verificar_fase1_setup.sql`. |
| URL de entrada | **http://localhost:3000/dashboard** (o **http://localhost:3000/setup** si ya tienes sesión). |
| Usuario de prueba | Opción rápida: `POST /api/auth/seed-test-user` → usar **admin@domus.local** / **Admin123!**. O crear en `/register` (email se confirma automáticamente si hay SERVICE_ROLE_KEY). |
| Variables de entorno | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. |

No se avanza a Fase 2; esta guía deja Fase 1 lista para prueba manual.
