# Pasos: variables en Vercel para que funcione el login

Para que el login en **domus-fam.com** funcione, Vercel necesita las variables de Supabase. Sigue estos pasos.

---

## Parte 1: Obtener los valores desde Supabase

1. Entra en **https://supabase.com** e inicia sesión.
2. Abre el **proyecto** que usa Domus (el que tiene tus usuarios).
3. En el menú izquierdo: **Settings** (icono de engranaje) → **API**.
4. En la página API verás:
   - **Project URL** (ej. `https://abcdefgh.supabase.co`) → este es **NEXT_PUBLIC_SUPABASE_URL**.
   - **Project API keys** → la que dice **anon** / **public** (no la `service_role`) → esta es **NEXT_PUBLIC_SUPABASE_ANON_KEY**.
5. **Copia** y guarda ambos valores (en un bloc de notas o donde quieras) para pegarlos en Vercel.

---

## Parte 2: Añadir las variables en Vercel

1. Entra en **https://vercel.com** e inicia sesión.
2. Abre el proyecto **domus-plus** (Gonzalo M's project).
3. Arriba: **Settings**.
4. En el menú de la izquierda: **Environment Variables**.
5. Verás una tabla y un botón **Add New** (o **Add**).
6. **Primera variable:**
   - **Key (Name):** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** pega la **Project URL** que copiaste de Supabase (ej. `https://xxxxx.supabase.co`).
   - **Environments:** marca **Production** (y si quieres también Preview).
   - Pulsa **Save**.
7. **Segunda variable:**
   - Pulsa otra vez **Add New** (o edita si ya existe).
   - **Key (Name):** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** pega la clave **anon public** que copiaste de Supabase.
   - **Environments:** marca **Production** (y si quieres Preview).
   - Pulsa **Save**.

---

## Parte 3: Aplicar los cambios (nuevo deployment)

Las variables solo se aplican en **nuevos** deployments. El código debe estar en el repo (push a `main`) y Vercel debe construir desde la carpeta **frontend** (Settings → General → Root Directory = `frontend`).

1. En Vercel, ve a **Deployments**.
2. En el **primer deployment** (el más reciente), haz clic en los **tres puntos** (⋮) a la derecha.
3. Elige **Redeploy**.
4. Confirma (deja "Use existing Build Cache" como esté) y espera a que termine.
5. Cuando el estado sea **Ready**, el login en **domus-fam.com** usará ya las variables nuevas.

---

## Resumen rápido

| Dónde   | Qué hacer |
|--------|-----------|
| Supabase → Settings → API | Copiar **Project URL** y **anon public key** |
| Vercel → domus-plus → Settings → Environment Variables | Añadir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para **Production** |
| Vercel → Deployments | **Redeploy** del último deployment para que cargue las variables |

Cuando termines, prueba de nuevo el login en **https://domus-fam.com/login** con tu email y contraseña.
