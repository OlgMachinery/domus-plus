# Deploy en Hostinger (VPS)

## Scripts en el repo

- **`frontend/deploy.sh`** – Ejecutar desde dentro de `frontend/`: instala deps y hace build.
- **`deploy-hostinger.sh`** (raíz) – Ejecutar desde la raíz: entra en `frontend/` si existe, instala deps y hace build.

En el servidor, después de `git pull`:

```bash
cd /srv/domus/app
git pull
# Si /srv/domus/app es el contenido de frontend:
./deploy.sh
# Si /srv/domus/app es el repo completo:
./deploy-hostinger.sh
```

Asegúrate de que el script sea ejecutable: `chmod +x deploy.sh` o `chmod +x deploy-hostinger.sh`.

## Errores típicos del build y soluciones

### 1. `Cannot find module '@tailwindcss/postcss'`

**Causa:** En el servidor se está instalando solo dependencias de producción (`npm install --production` o `npm ci --omit=dev`). El build de Next.js necesita **devDependencies** para compilar CSS (Tailwind/PostCSS).

**Solución:** En el script de deploy, instalar **todas** las dependencias antes del build:

```bash
cd /srv/domus/app
npm install
# o, si usas lockfile estricto:
npm ci
```

No uses `npm install --omit=dev` ni `--production` antes de `npm run build`.

### 2. Módulos no encontrados (`@/components/AppLayout`, `xlsx`, `date-fns`, etc.)

**Causa:** Mismo motivo: faltan dependencias (o el `package.json` del servidor no coincide con el del repo).

**Solución:**

- Asegúrate de que el deploy hace **pull** del mismo código que tiene el `package.json` actualizado (con `xlsx`, `date-fns`, `lucide-react`, `@supabase/ssr`, `@supabase/supabase-js`, `openai`, etc.).
- Vuelve a instalar sin omitir dev: `npm install` o `npm ci`.

### 3. Estructura del proyecto desplegado

El **frontend** de este repo tiene:

- `app/` en la raíz (rutas Next.js)
- `components/`, `lib/`, etc. en la raíz
- `tsconfig` con `"@/*": ["./*"]` (alias `@/` = raíz del proyecto)

Si en el servidor el directorio de trabajo del build es la raíz del frontend (por ejemplo `/srv/domus/app` = clon del repo con `frontend/` como raíz, o el contenido de `frontend/` copiado ahí), no hace falta carpeta `src/`. Si el script copia solo parte del código y usa otra estructura, el `tsconfig.json` y la ruta de trabajo deben coincidir con esa estructura.

## Checklist para el script de deploy

1. **Entrar al directorio correcto:** `cd /srv/domus/app` (o la ruta donde esté el frontend).
2. **Actualizar código:** `git pull` (o el método que uses).
3. **Instalar dependencias (incluidas dev):** `npm ci` o `npm install`. No usar `--omit=dev`.
4. **Build:** `npm run build`.
5. **Reiniciar el servicio:** p. ej. `pm2 restart domus` o `systemctl restart tu-servicio`.

## Ejemplo de script mínimo

```bash
#!/bin/bash
set -e
cd /srv/domus/app
git pull
npm ci
npm run build
# Reiniciar el proceso que sirve la app (ajustar según tu setup)
# systemctl restart domus-next
# o: pm2 restart domus
```

Si el build sigue fallando, ejecuta en el servidor `npm ls @tailwindcss/postcss` después de `npm ci`; si no aparece, la instalación no está trayendo dependencias.

**Nota:** En este repo, `@tailwindcss/postcss` y `tailwindcss` están en `dependencies` (no en devDependencies) para que el build funcione aunque en el servidor se use `npm install --production`.
