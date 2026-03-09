# Instrucciones para IA: Auth y seed en DOMUS+ (Supabase)

Usa este documento como base para que un asistente de IA configure el login y el usuario de prueba sin que el usuario tenga que entrar manualmente al panel de Supabase.

---

## Objetivo

- Login funcional en `/login` (sin "Invalid login credentials").
- Endpoint `POST /api/auth/seed-test-user` que cree un usuario admin de prueba y permita entrar sin tocar Supabase.
- Variables de entorno correctas en `frontend/.env.local`.

---

## Variables de entorno requeridas

En **`frontend/.env.local`** deben existir exactamente estas variables (con los valores del proyecto Supabase del usuario):

| Variable | Dónde se obtiene en Supabase | Uso |
|----------|------------------------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Connect → API Keys → **Project URL** | Cliente y servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Connect → API Keys → **Anon Key (Legacy)** (la JWT que empieza por `eyJ...`) | Cliente y login; NUNCA usar service_role en el cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings → API** → pestaña **Legacy API Keys** → **service_role** (la JWT larga, no la anon) | Solo servidor: seed-test-user, registro con auto-confirmar email, crear integrantes |

Importante sobre la service_role:

- La clave en formato **`sb_secret_...`** (nueva en Supabase) **no** es aceptada por la API de Auth Admin del SDK (`createUser`, `updateUserById`). Da error "Invalid API key".
- Para el seed y para auto-confirmar email en el registro hay que usar la **service_role en formato JWT** (empieza por `eyJ...`).
- Esa JWT está en: **Supabase Dashboard → Project Settings → API → Legacy API Keys → service_role**. Si el usuario solo tiene "API settings" desde Connect, indicarle que entre a **Project Settings → API** (menú del proyecto) y busque la pestaña o sección **Legacy API Keys**.

Si el usuario pega una clave `sb_secret_...` en `SUPABASE_SERVICE_ROLE_KEY`, el seed fallará con "Invalid API key". La IA debe indicarle que reemplace por la JWT de Legacy API Keys, o documentar esto en `frontend/ENV_SUPABASE.md`.

---

## Comportamiento esperado del código (ya implementado)

- **Cliente** (`frontend/lib/supabase/client.ts`): Solo usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`). No debe usarse nunca `SUPABASE_SERVICE_ROLE_KEY` en el cliente.
- **Login** (página y API): Usan solo anon key. La página llama a `supabase.auth.signInWithPassword()` con el cliente del navegador.
- **Registro** (`/api/auth/register`): Tras `signUp()`, si existe `SUPABASE_SERVICE_ROLE_KEY`, se llama a `admin.auth.admin.updateUserById(..., { email_confirm: true })` para que el usuario pueda hacer login sin confirmar email manualmente. Si el INSERT en `public.users` falla por RLS, se reintenta con cliente admin (service role) en servidor.
- **Seed** (`POST /api/auth/seed-test-user`): Solo en desarrollo o con `ALLOW_SEED_TEST_USER=true`. Usa service role para: crear usuario en Auth (email confirmado), insertar/actualizar en `public.users` con `is_family_admin = true`. Credenciales fijas: **admin@domus.local** / **Admin123!**

---

## Pasos que la IA debe seguir

1. **Comprobar variables**
   - Verificar que en `frontend/.env.local` existan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o equivalente público) y `SUPABASE_SERVICE_ROLE_KEY`.
   - Si falta la service_role, añadir la línea con placeholder y un comentario que diga: pegar aquí la clave **service_role** en formato JWT (eyJ...) desde Supabase → Project Settings → API → Legacy API Keys.
   - Si el usuario proporciona una clave `sb_secret_...`, guardarla en `SUPABASE_SERVICE_ROLE_KEY` pero advertir (o documentar) que el seed puede fallar con "Invalid API key" hasta que use la JWT de Legacy API Keys.

2. **No usar service_role en el cliente**
   - Confirmar que `frontend/lib/supabase/client.ts` (y cualquier cliente usado en el navegador) solo use variables `NEXT_PUBLIC_*` y en ningún caso `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_SECRET_KEY`.

3. **Mensaje claro si el seed falla por API key**
   - Si `POST /api/auth/seed-test-user` devuelve "Invalid API key", la respuesta debe indicar que se use la clave **service_role en formato JWT** desde Legacy API Keys (ver archivo `frontend/ENV_SUPABASE.md` o este doc).

4. **Probar sin panel de Supabase**
   - Tras configurar env: reiniciar `npm run dev` en `frontend/`, luego ejecutar `curl -X POST http://localhost:3000/api/auth/seed-test-user`.
   - Si la respuesta es éxito, el usuario puede entrar en `http://localhost:3000/login` con **admin@domus.local** / **Admin123!**.
   - Si falla por "Invalid API key", indicar al usuario que reemplace `SUPABASE_SERVICE_ROLE_KEY` por la JWT de Legacy API Keys y repita.

5. **Documentación**
   - Mantener actualizado `frontend/ENV_SUPABASE.md` con: qué variable es cada una, dónde se copia en Supabase (Connect vs API settings / Legacy API Keys), y que para Auth Admin (seed, registro) se necesita la service_role JWT.

---

## Resumen para el usuario final

- **Credenciales de prueba (tras seed correcto):** Email **admin@domus.local**, contraseña **Admin123!**.
- **Crear el usuario de prueba:** `curl -X POST http://localhost:3000/api/auth/seed-test-user` (con el servidor en marcha y `SUPABASE_SERVICE_ROLE_KEY` en formato JWT en `.env.local`).
- **Si el seed dice "Invalid API key":** En Supabase → Project Settings → API → Legacy API Keys, copiar la clave **service_role** (JWT) y ponerla en `SUPABASE_SERVICE_ROLE_KEY` en `frontend/.env.local`, luego reiniciar el servidor y volver a ejecutar el curl.

---

## Incorporar cambios a producción

1. **Código:** Hacer push de los cambios a la rama que despliega producción (por ejemplo `main`). Los cambios relevantes son: registro con auto-confirmar email, endpoint seed-test-user (deshabilitado en producción por defecto), uso solo de anon key en el cliente.

2. **Variables en el host (ej. Vercel):**
   - **Settings → Environment Variables** del proyecto.
   - Añadir o revisar para el entorno **Production** (y Preview si aplica):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY` (formato JWT desde Supabase → API → Legacy API Keys). Sin esta variable, en producción el registro no podrá auto-confirmar el email ni crear la fila en `public.users` si RLS lo impide.
   - No usar en producción `ALLOW_SEED_TEST_USER=true` (el endpoint de seed debe quedar deshabilitado).

3. **Redeploy:** Tras guardar variables, en **Deployments** → menú (⋯) del último deployment → **Redeploy** para que el build use las nuevas variables. Las variables solo se inyectan en builds nuevos.

4. **Supabase (producción):** En **Authentication → URL Configuration**, tener **Site URL** y **Redirect URLs** con el dominio de producción (ej. `https://domus-fam.com`, `https://domus-fam.com/**`).

5. **Resumen:** Push a `main` → configurar las tres variables en Vercel (con la service_role en JWT) → Redeploy → verificar login y registro en el dominio de producción.
