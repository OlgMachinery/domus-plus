# Usuario demo (acceso rápido)

Para usar el botón **"Entrar como demo (1 clic)"** en la pantalla de login, crea un usuario en Supabase con estas credenciales:

- **Email:** `demo@domus-fam.com`
- **Contraseña:** `demo`

## Pasos en Supabase

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto.
2. Ve a **Authentication** → **Users** → **Add user** → **Create new user**.
3. Rellena:
   - **Email:** `demo@domus-fam.com`
   - **Password:** `demo`
   - (Opcional) En **User Metadata** añade: `{"name": "Demo"}` para que aparezca el nombre en la app.
4. Marca **Auto Confirm User** (o confirma el email manualmente después).
5. Guarda.

La primera vez que entres con "Entrar como demo", la app intentará crear el perfil en `public.users` (sync). Si tu proyecto tiene RLS o requiere familia, puede que tengas que asignar al usuario a una familia desde el panel de Usuarios o ejecutando SQL según tu configuración.

## Cambiar email o contraseña del demo

Si quieres otro email o contraseña para el demo, edita en el frontend:

- `frontend/app/login/page.tsx` → constantes `DEMO_EMAIL` y `DEMO_PASSWORD`.
