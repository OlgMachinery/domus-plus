# Configuración Vercel — 404 en rutas (ej. /budget-overview)

Este repositorio es un **monorepo**: la app Next.js está en la carpeta **`frontend`**.

Para que todas las rutas (incluida `/budget-overview`) funcionen en producción:

1. Entra en **Vercel** → tu proyecto → **Settings** → **General**.
2. En **Root Directory** haz clic en **Edit**.
3. Escribe: **`frontend`** (sin barra final).
4. Guarda y **redeploy** el proyecto.

Si Root Directory está vacío o apunta a otra carpeta, Vercel construye desde la raíz del repo y la app Next (y sus rutas) no se despliegan correctamente.
