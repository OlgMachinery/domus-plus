# Arreglar "db": "down" en la VPS

Cuando **https://domus-fam.com/api/health** devuelve `{"status":"error","db":"down"}` o el login muestra *"No se pudo iniciar sesión. Revisa que la base de datos esté accesible"*, la app no puede conectar con SQLite. Suele ser **ruta de la BD** o **permisos**.

## Evitar que vuelva a pasar en cada deploy

Tras cada `deploy-vps.sh`, **rsync** deja archivos como **root** y **npm ci / npm run build** crean `node_modules` y `.next` como root. Si el servicio corre como `deploy`, no podrá leer/escribir bien y el login fallará. Para que cada deploy deje todo con el dueño correcto, usa **una** de estas opciones:

- **Recomendado:** exportar el usuario del servicio y desplegar desde `domus-beta-dbe`:
  ```bash
  export DOMUS_DEPLOY_USER=deploy
  export DOMUS_VPS_HOST=187.77.16.4
  SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh
  ```
  El script hará `chown -R deploy:deploy` **después** del build y antes del restart.

- O pasar `--chown deploy` en cada deploy:
  ```bash
  SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --host 187.77.16.4 --chown deploy
  ```

## 1. Conectarte por SSH

```bash
ssh -i ~/.ssh/id_ed25519_domus root@187.77.16.4
```

## 2. Ver dónde está la app y con qué usuario corre

```bash
# Ruta del proyecto (ajusta si usas otra)
APP_DIR="/srv/domus/app"
# o si usas el servicio de ejemplo:
# APP_DIR="/var/www/domus-beta-dbe"

# Usuario del servicio (mirar en systemd)
cat /etc/systemd/system/domus-beta.service | grep User
# Suele ser www-data o deploy
SERVICE_USER="www-data"
```

Ajusta `APP_DIR` y `SERVICE_USER` según tu instalación.

## 3. Crear/ajustar .env con DATABASE_URL

```bash
cd $APP_DIR

# Si no existe .env, créalo
if [ ! -f .env ]; then
  echo 'DATABASE_URL="file:./prisma/dev.db"' > .env
  echo 'NODE_ENV=production' >> .env
fi

# Ver qué DATABASE_URL tienes
grep DATABASE_URL .env
```

Si usas una ruta fija (recomendado en producción), por ejemplo:

```bash
mkdir -p /var/lib/domus-beta-dbe
echo 'DATABASE_URL="file:/var/lib/domus-beta-dbe/domus.db"' > $APP_DIR/.env
echo 'NODE_ENV=production' >> $APP_DIR/.env
```

## 4. Dar permisos al usuario del servicio

El usuario que corre el servicio (p. ej. `www-data`) debe poder **leer y escribir** la carpeta de la app y el archivo de la BD.

```bash
cd $APP_DIR
chown -R $SERVICE_USER:$SERVICE_USER .
```

Si la BD está en otro sitio (p. ej. `/var/lib/domus-beta-dbe/`):

```bash
chown -R $SERVICE_USER:$SERVICE_USER /var/lib/domus-beta-dbe
```

## 5. Crear las tablas (solo la primera vez)

Si la base de datos no existe o está vacía, crear el esquema con Prisma:

```bash
cd $APP_DIR
sudo -u $SERVICE_USER npx prisma db push
```

(O como root: `npx prisma db push` y luego `chown` otra vez del archivo de la BD al `$SERVICE_USER`.)

## 6. Reiniciar el servicio

```bash
systemctl restart domus-beta
```

## 7. Comprobar

Abre en el navegador:

```
https://domus-fam.com/api/health
```

Deberías ver algo como: `{"status":"ok","db":"connected","users":0}`.  
Si `users` es 0, crea una cuenta desde **https://domus-fam.com/ui** (Registrarse).

## Resumen rápido (copia/pega)

Ajusta `APP_DIR` y `SERVICE_USER` y ejecuta en la VPS:

```bash
APP_DIR="/srv/domus/app"
SERVICE_USER="www-data"

cd $APP_DIR
[ ! -f .env ] && echo 'DATABASE_URL="file:./prisma/dev.db"' > .env && echo 'NODE_ENV=production' >> .env
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
sudo -u $SERVICE_USER npx prisma db push
systemctl restart domus-beta
```

Luego verifica: **https://domus-fam.com/api/health**
