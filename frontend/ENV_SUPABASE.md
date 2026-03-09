# Cómo llenar `frontend/.env.local` con Supabase

## Desde el modal "Connect to your project"

| Variable en `.env.local` | Dónde copiarla en Supabase |
|-------------------------|----------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** (ej. `https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Anon Key (Legacy)** — la larga que empieza con `eyJ...` (para login y cliente). |
| Opcional: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | **Publishable Key** (`sb_publishable_...`) si tu proyecto usa ese nombre. |

## Clave service_role (para seed, registro, crear integrantes)

Para **Auth Admin** (crear usuarios, confirmar email) el SDK de Supabase suele requerir la clave en **formato JWT** (empieza por `eyJ...`), no la `sb_secret_...`.

- En Supabase: **Project Settings → API**.
- Abre la pestaña **"Legacy API Keys"** (no solo "Connect").
- Copia la clave **service_role** (la larga JWT, no la anon).
- En `.env.local`:
  ```env
  SUPABASE_SERVICE_ROLE_KEY=eyJ... (pegarla completa)
  ```
- Si usas solo la clave **Secret** (`sb_secret_...`) puede aparecer "Invalid API key" en el seed; en ese caso usa la JWT de Legacy API Keys.

## Ejemplo mínimo para login + seed

```env
NEXT_PUBLIC_SUPABASE_URL=https://hmcobjsmmfuvkycyzyfb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (Anon Key Legacy del modal)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (desde API settings → service_role)
```

Reinicia `npm run dev` después de guardar.
