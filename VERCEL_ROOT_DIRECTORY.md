# Despliegue en Vercel

La app Next.js está en la **raíz del repositorio** (app/, components/, lib/, etc.).

- **Root Directory** en Vercel debe estar **vacío** (no poner `frontend`).
- El build usa el `package.json` y `next.config.js` de la raíz.
- Todas las rutas (incluida `/budget-overview`) se sirven desde la raíz.

Para desarrollo local: desde la raíz ejecuta `npm run dev` (o usa `reiniciar_servidores.sh`).
