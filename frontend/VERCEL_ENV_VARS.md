# Login en Vercel: "Load failed" – qué revisar

Si en **domus-plus.vercel.app** o **domus-fam.com** ves "Load failed" al iniciar sesión, revisa estos dos puntos.

---

## 1. Variables de entorno en Vercel

1. **Vercel:** https://vercel.com → proyecto **domus-plus** → **Settings** → **Environment Variables**.
2. Deben existir:
   - `NEXT_PUBLIC_SUPABASE_URL` (de Supabase → Project Settings → API → Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public, no service_role)
3. Después: **Deployments** → ⋯ del último deploy → **Redeploy**.

---

## 2. URL Configuration en Supabase (importante)

Si las variables ya están en Vercel y sigue fallando, hay que permitir el dominio en Supabase:

1. **Supabase:** https://supabase.com/dashboard → tu proyecto.
2. **Authentication** → **URL Configuration**.
3. **Site URL:** pon `https://domus-plus.vercel.app` (o tu dominio, ej. `https://domus-fam.com`).
4. **Redirect URLs:** añade:
   - `https://domus-plus.vercel.app/**`
   - Si usas otro dominio: `https://domus-fam.com/**`
5. Guarda.

Con eso, el navegador podrá conectar con Supabase desde tu app en Vercel y el "Load failed" debería desaparecer. Prueba en ventana de incógnito o con recarga forzada (Cmd+Shift+R).

---

## 3. Login demo (opcional)

Para que el botón "Entrar como demo" funcione, añade en Vercel (Environment Variables):

- `DEMO_EMAIL`: email del usuario demo.
- `DEMO_PASSWORD`: contraseña del usuario demo (solo en servidor, no aparece en el código).
