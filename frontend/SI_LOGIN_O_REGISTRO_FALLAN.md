# Si login o registro fallan ("fetch failed" / "Load failed")

Sigue estos pasos **en orden**. En cada paso, prueba de nuevo el login o el registro.

---

## 1. Comprobar si el servidor responde

1. Abre en el navegador: **https://domus-plus.vercel.app/api/health**
2. Deberías ver algo como: `{"ok":true,"message":"El servidor responde correctamente.",...}`

- **Si ves ese JSON:** el servidor está bien; el fallo suele ser de Supabase o de tiempo. Sigue al paso 2.
- **Si no carga o da error:** el problema es de red o de Vercel. Prueba otra red (móvil, otro WiFi), otro navegador (Chrome) o en modo incógnito. Si sigue igual, puede ser firewall o que Vercel esté caído.

---

## 2. Probar en local (para descartar que sea solo producción)

En la terminal:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/frontend
npm run dev
```

Abre **http://localhost:3000** (o el puerto que indique) e intenta **iniciar sesión** o **registrarte**.

- **Si en local funciona:** el código está bien; el fallo en producción suele ser variables de entorno en Vercel o tiempo de espera. Sigue al paso 3.
- **Si en local también falla:** revisa que exista `frontend/.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (valores de tu proyecto en Supabase).

---

## 3. Variables de entorno en Vercel

1. Entra en **https://vercel.com** → proyecto **domus-plus** → **Settings** → **Environment Variables**.
2. Deben existir (y estar activas para Production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Después: **Deployments** → menú (⋯) del último deploy → **Redeploy**.

---

## 4. Supabase: URL permitida

1. **https://supabase.com/dashboard** → tu proyecto.
2. **Authentication** → **URL Configuration**.
3. **Site URL:** `https://domus-plus.vercel.app`
4. **Redirect URLs:** añade `https://domus-plus.vercel.app/**`
5. Guarda.

---

## 5. Si sigue fallando

- Prueba desde **otro dispositivo o red** (por ejemplo, datos del móvil).
- En **Vercel** → proyecto → **Deployments** → el último deploy → **Functions** o **Logs**, y revisa si hay errores al llamar a `/api/auth/login` o `/api/auth/register`.
- En **Supabase** → **Project Settings** → comprueba que el proyecto no esté pausado.

---

**Resumen:**  
1) Probar `/api/health`.  
2) Probar en local con `npm run dev`.  
3) Revisar variables en Vercel y redeploy.  
4) Revisar URL en Supabase.  
5) Otra red/dispositivo y logs en Vercel/Supabase.
