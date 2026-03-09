# Mantener el sistema funcionando sin repetir errores

Guía para que los cambios no reintroduzcan problemas ya resueltos.

**Importante:** El diagrama y la app en producción se ven **solo en domus-fam.com**. Es el único hogar/entorno donde se quiere verlo. Para aplicar cualquier cambio ahí hay que **desplegar domus-beta-dbe a la VPS** (no basta con push a GitHub).

---

## Problemas que ya resolvimos (no volver a caer en ellos)

| Problema | Causa | Qué hacer para que no vuelva |
|----------|--------|------------------------------|
| **Los cambios no se ven en domus-fam.com** | El sitio se sirve desde la **VPS**, no desde GitHub. Solo con `git push` no se actualiza la web. | Después de editar, **desplegar a la VPS** con `domus-beta-dbe/deploy/deploy-vps.sh` (ver más abajo). |
| **503 o login/DB fallan tras el deploy** | En la VPS los archivos quedan como `root` y el servicio corre como `deploy`; sin permisos correctos falla. | Usar **siempre** `--chown deploy` al ejecutar el script (o `export DOMUS_DEPLOY_USER=deploy`). |
| **Editar el diagrama en app/ o frontend/ y que se pierda** | La fuente canónica es **domus-beta-dbe**. Si editas en otro sitio, el próximo sync lo pisa. | Editar **solo** `domus-beta-dbe/src/app/ui/system-architecture/page.tsx`. Si quieres copiar a app/frontend: `npm run sync:diagram` desde la raíz. |
| **No saber si producción tiene el código nuevo** | No se comprobaba qué versión estaba desplegada. | Tras cada deploy, comprobar **https://domus-fam.com/api/build-info** (campo `version` debe coincidir con el del repo). |
| **Parecer que los cambios no llegaron por caché** | Navegador o CDN sirven la versión antigua. | Probar en **ventana de incógnito** o con caché desactivada tras el deploy. |
| **Perder las API keys (DO_SPACES, OpenAI) al desplegar** | El script de deploy **nunca sube ni sobrescribe** el `.env` del servidor (está en la lista `--exclude`). | Las claves están seguras. El `.env` que usa la app en producción es el que ya está en la VPS, en el mismo directorio que el proyecto (el que indica `EnvironmentFile` en el servicio systemd). No reemplaces ese `.env` por uno nuevo sin hacer copia. |

---

## Antes de hacer un cambio

1. **Saber dónde editar**
   - Lo que va a **domus-fam.com** → solo en **domus-beta-dbe/**.
   - Página del diagrama → solo en `domus-beta-dbe/src/app/ui/system-architecture/page.tsx`.
2. **Tener el workspace correcto**  
   Raíz del repo: `domus-plus` (no solo la carpeta `frontend` o `domus-beta-dbe`).

---

## Después de hacer un cambio (subir a producción)

1. **Commit/push** (si quieres dejar el código en GitHub).
2. **Deploy a la VPS** (obligatorio para que se vea en domus-fam.com):

   **Resumen:** Siempre usar **clave SSH** para evitar "Permission denied". Si tu terminal está en **domus-beta-dbe**, no uses `./domus-beta-dbe/...` (esa ruta no existe desde ahí); usa `./deploy/deploy-vps.sh`.

   - **Desde la raíz del repo (domus-plus):**
     ```bash
     cd /Users/gonzalomontanofimbres/domus-plus
     SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy
     ```
   - **Desde la carpeta domus-beta-dbe:**
     ```bash
     cd /Users/gonzalomontanofimbres/domus-plus/domus-beta-dbe
     SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --host 187.77.16.4 --chown deploy
     ```
   (Sustituye `id_ed25519_domus` por tu clave privada si usas otro nombre.)
3. **Comprobar**
   - Abrir **https://domus-fam.com/api/build-info** → el campo `version` debe coincidir con `BUILD_VERSION` en `domus-beta-dbe/src/app/api/build-info/route.ts`.
   - Abrir **https://domus-fam.com/ui/system-architecture** en **incógnito** y revisar que la UI sea la esperada.
4. **Si usas app/ o frontend/**  
   Desde la raíz: `npm run sync:diagram` para copiar la página del diagrama.

---

## Si algo falla tras el deploy

- **503 o página en blanco:** Esperar 30 s y probar de nuevo (arranque del servicio). Si sigue: SSH a la VPS y revisar `sudo systemctl status domus-beta` y `sudo journalctl -u domus-beta -n 60`.
- **"Falta OPENAI_API_KEY en el servidor"** al extraer un ticket: En la VPS, en el directorio de la app (ej. `/srv/domus/app`), añadir `OPENAI_API_KEY=sk-...` al archivo `.env` y ejecutar `sudo systemctl restart domus-beta`. Ver `domus-beta-dbe/docs/DONDE_ESTA_ENV.md`.
- **"Falta configurar DigitalOcean Spaces"** (subida de comprobantes no funciona): Abre `https://domus-fam.com/api/dev/spaces-check` para ver qué variables faltan. Luego en el `.env` de la VPS añade DO_SPACES_KEY, DO_SPACES_SECRET, DO_SPACES_BUCKET, DO_SPACES_ENDPOINT, DO_SPACES_REGION (crear Space y Spaces Keys en DigitalOcean). Ver `domus-beta-dbe/docs/DONDE_ESTA_ENV.md` (sección "Falta configurar DigitalOcean Spaces").
- **Sigue la versión antigua:** Comprobar que ejecutaste el script **desde la carpeta domus-beta-dbe** (o desde la raíz con `./deploy-domus-fam.sh`) y que el código que tienes ahí es el correcto. Volver a desplegar si hace falta.
- **Login o base de datos fallan:** Ver `domus-beta-dbe/docs/VPS_DB_DOWN.md` y asegurar que el deploy usa `--chown deploy`.
- **"Permission denied" o "Connection closed" al hacer deploy:** El servidor rechaza la contraseña (o la corta tras varios intentos). Usa **clave SSH**: `SSH_OPTS="-i $HOME/.ssh/tu_clave" ./deploy-domus-fam.sh --host 187.77.16.4 --chown deploy`. En la VPS, la clave pública debe estar en `~root/.ssh/authorized_keys`. Si no la tienes, genera un par con `ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_domus` y copia la pública a la VPS con `ssh-copy-id -i ~/.ssh/id_ed25519_domus.pub root@187.77.16.4` (te pedirá la contraseña una vez).

---

## Dónde está cada cosa

| Necesito… | Dónde |
|-----------|--------|
| Deploy a domus-fam.com | `docs/VERIFICAR_DEPLOY_DOMUS_FAM.md` |
| Unificación y flujo (una fuente, sync) | `docs/UNIFICACION_Y_DEPLOY.md` |
| Estructura del repo y workspace | `docs/WORKSPACE_Y_PROYECTO.md` y `.cursor/rules/workspace-y-estructura.mdc` |
| Esta guía de mantenimiento | `docs/MANTENIMIENTO_SISTEMA.md` |

---

## Backup y recuperación de la base de datos

- **Backup:** En la VPS (o en tu máquina si usas SQLite local), la base de datos suele estar en el directorio del proyecto, por ejemplo `prisma/dev.db` o el path indicado en `DATABASE_URL`. Para hacer una copia:
  ```bash
  cp prisma/dev.db prisma/backup-$(date +%Y%m%d-%H%M).db
  ```
  O con `sqlite3`: `sqlite3 prisma/dev.db ".backup prisma/backup.db"`.
- **Frecuencia recomendada:** Según criticidad (diario/semanal). Si hay muchos usuarios o datos, automatizar con un cron que copie el archivo a un directorio seguro o a otro servidor.
- **Recuperación:** Detener la app, reemplazar el archivo de la base de datos por el backup, volver a arrancar la app. Si usas migraciones, asegurarse de que el backup sea de una versión compatible con el schema actual.

---

## Regla de oro

**Para domus-fam.com:** editar en **domus-beta-dbe** → desplegar con el **script VPS** (con `--chown deploy`) → comprobar **/api/build-info** y la página en incógnito. Así el sistema sigue funcionando sin parar por los mismos problemas de antes.
