# Si domus-fam.com/budget-overview sigue en 404

La app Next.js (y la ruta `/budget-overview`) está en la **raíz del repo**, no en `frontend/`. Si Vercel tiene **Root Directory** = `frontend`, construye la carpeta vieja y por eso da 404.

## Pasos en Vercel

1. Entra a **https://vercel.com** → proyecto que sirve **domus-fam.com**.
2. **Settings** → **General**.
3. Busca **Root Directory**.
   - Si pone `frontend` (o cualquier cosa): clic en **Edit**, **borra** el valor y deja el campo **vacío**. Guarda.
   - Si ya está vacío: sigue al paso 4.
4. **Deployments** → en el último deployment, menú **⋯** → **Redeploy** (sin cache si quieres estar seguro).
5. Espera a que termine el build y prueba de nuevo **https://domus-fam.com/budget-overview**.

## Cómo comprobar qué se está desplegando

En el **último deployment** → pestaña **Building** (logs):

- Si ves algo como `Installing dependencies` / `npm run build` **sin** `cd frontend`, se está construyendo desde la raíz (correcto).
- Si ves `frontend/package.json` o el build dentro de `frontend/`, entonces Root Directory sigue siendo `frontend` y hay que dejarlo vacío y volver a desplegar.

## Repo

- Rama: **main**
- Repo: **OlgMachinery/domus-plus** (o el que tengas conectado)
- En la raíz debe haber: `app/`, `package.json`, `next.config.js` y `app/budget-overview/page.tsx`.
