# Dónde está el .env y qué variables usar

## Ubicación del .env

El archivo **`.env`** va en la **raíz del proyecto**:

```
domus-beta-dbe/.env
```

No está en el repo por seguridad (contiene API keys). Tienes que crearlo tú.

## Cómo tener tu .env con DO, OpenAI, etc.

1. Copia la plantilla:
   ```bash
   cp .env.example .env
   ```
2. Abre **`.env`** en Cursor (en la raíz del proyecto, mismo nivel que `package.json`).
3. Rellena al menos:
   - **DATABASE_URL** — ya viene con `file:./prisma/dev.db`
   - **JWT_SECRET** — un string largo y aleatorio (ej. `openssl rand -hex 32`)
4. Opcional, para extracción de recibos con IA:
   - **OPENAI_API_KEY** — tu clave de OpenAI
   - **OPENAI_RECEIPT_MODEL** — p. ej. `gpt-4o-mini`
5. Opcional, para subir imágenes (DigitalOcean Spaces):
   - **DO_SPACES_ENDPOINT**, **DO_SPACES_REGION**, **DO_SPACES_KEY**, **DO_SPACES_SECRET**, **DO_SPACES_BUCKET**

La lista completa está en **`.env.example`** en la raíz del proyecto.

---

## Error: "Falta OPENAI_API_KEY en el servidor" al extraer un ticket

La extracción de recibos (proveedor, total, etc.) usa OpenAI. Si en **domus-fam.com** al registrar un gasto con comprobante sale ese mensaje:

1. **En la VPS** donde está desplegada la app (ej. `/srv/domus/app` o la ruta que use tu servicio), abre o crea el archivo **`.env`** en ese directorio.
2. Añade una línea con tu clave de OpenAI:
   ```bash
   OPENAI_API_KEY=sk-proj-...tu-clave...
   ```
   (Opcional: `OPENAI_RECEIPT_MODEL=gpt-4o-mini` si quieres fijar el modelo.)
3. **Reinicia el servicio** para que cargue la variable:
   ```bash
   sudo systemctl restart domus-beta
   ```
4. Vuelve a probar "Registrar gasto con comprobante" y la extracción del ticket.

La clave la obtienes en [platform.openai.com](https://platform.openai.com/api-keys). El deploy no sobrescribe el `.env` del servidor (está en la lista de exclusiones del rsync).

---

## "Falta configurar DigitalOcean Spaces (DO_SPACES_*)" — no funciona la subida de comprobantes

Si al registrar un gasto con comprobante o adjuntar un recibo sale ese mensaje y **no funciona**:

### 1. Ver qué falta (diagnóstico)

En el navegador (o con `curl`) abre:

- **Producción:** `https://domus-fam.com/api/dev/spaces-check`
- **Local:** `http://localhost:3001/api/dev/spaces-check`

La respuesta indica qué variables faltan (sin mostrar valores), por ejemplo:

```json
{ "ok": false, "missing": ["DO_SPACES_KEY", "DO_SPACES_BUCKET"], "message": "Faltan: ..." }
```

### 2. Crear el Space y las llaves en DigitalOcean

1. Entra a [DigitalOcean → Spaces](https://cloud.digitalocean.com/spaces).
2. **Crear un Space** (nombre del bucket, región, ej. `nyc3`). Anota:
   - Nombre del bucket (ej. `domus-recibos`)
   - Región (ej. `nyc3`)
   - Endpoint (ej. `https://nyc3.digitaloceanspaces.com`)
3. **Crear API key para Spaces:** en DigitalOcean → API → **Spaces Keys** → *Generate New Key*. Te dan **Key** y **Secret** (la secret solo se muestra una vez; guárdala).

### 3. Añadir variables en la VPS

En la **VPS**, en el directorio de la app (ej. `/srv/domus/app` o el que use tu `domus-beta`), edita el archivo **`.env`** y añade o completa:

```bash
DO_SPACES_KEY=tu-key-copiada
DO_SPACES_SECRET=tu-secret-copiada
DO_SPACES_BUCKET=nombre-del-bucket
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_REGION=nyc3
```

(Ajusta `nyc3` y la URL si tu Space está en otra región, p. ej. `ams3`, `sfo3`.)

- **DO_SPACES_KEY** y **DO_SPACES_SECRET** deben ser de **Spaces Keys**, no el token general de la API de DigitalOcean.
- **DO_SPACES_BUCKET** debe ser exactamente el nombre del Space que creaste.
- **DO_SPACES_ENDPOINT** sin barra al final (ej. `https://nyc3.digitaloceanspaces.com`).

### 4. Reiniciar el servicio

```bash
sudo systemctl restart domus-beta
```

(Usa el nombre real del servicio si es otro, ej. `domus-beta-dbe`.)

### 5. Comprobar de nuevo

- Vuelve a abrir `/api/dev/spaces-check`: debe devolver `"ok": true`.
- Prueba otra vez "Registrar gasto con comprobante" o adjuntar un recibo.

Si sigue fallando, el mensaje de error puede indicar: bucket inexistente, llave inválida, secret incorrecta o permisos. Revisa que el nombre del bucket y la región coincidan con el Space creado.

### Importante: el deploy no toca el .env de la VPS

El script `deploy/deploy-vps.sh` tiene `--exclude ".env"`: **nunca sube ni sobrescribe** el `.env` del servidor. Las variables que pongas en el `.env` de la VPS (DO_SPACES_*, OPENAI_API_KEY, etc.) **no se eliminan** al desplegar. El archivo que lee la app es el que está en el mismo directorio que el proyecto en la VPS (el que usa `EnvironmentFile` en el servicio systemd). Si tu deploy va a `/srv/domus/app`, el `.env` que debe tener las keys es `/srv/domus/app/.env`. Si el servicio usa otra ruta (ej. `/var/www/domus-beta-dbe`), el `.env` debe estar ahí.
