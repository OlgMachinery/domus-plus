# Subir respaldo a DigitalOcean Spaces desde tu Mac

El script `upload-backup-to-spaces.mjs` sube el `.tar.gz` de respaldo a tu Space. Para que funcione **en tu Mac** necesitas las mismas variables `DO_SPACES_*` en tu archivo local `domus-beta-dbe/.env`.

## Opción A: Copiar desde la VPS (recomendado)

Si ya tienes la app desplegada en la VPS con Spaces configurado:

1. Conéctate por SSH a tu servidor.
2. En el directorio donde está el proyecto (ej. `/srv/domus/app` o el que uses), ejecuta:
   ```bash
   grep DO_SPACES .env
   ```
3. Copia las 5 líneas que salgan (KEY, SECRET, BUCKET, ENDPOINT, REGION).
4. En tu Mac, abre `domus-beta-dbe/.env` y pega esas líneas (o añádelas si ya tienes otras variables).
5. Guarda el archivo y ejecuta de nuevo:
   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/domus-beta-dbe
   node scripts/upload-backup-to-spaces.mjs ~/Desktop/domus-plus-respaldo-20260308-2125.tar.gz
   ```

## Opción B: Crear las variables en DigitalOcean

Si no tienes acceso a la VPS o prefieres usar una key solo para respaldos:

1. Entra a [DigitalOcean → API → Spaces Keys](https://cloud.digitalocean.com/account/api/spaces).
2. **Generate New Key** → pon nombre (ej. "backup-mac") → te dan **Key** y **Secret** (guarda el Secret; solo se muestra una vez).
3. En [Spaces](https://cloud.digitalocean.com/spaces) anota: **nombre del bucket** y **región** (ej. `nyc3`). El endpoint suele ser `https://<region>.digitaloceanspaces.com`.
4. En tu Mac, abre `domus-beta-dbe/.env` y añade (sustituye los valores):
   ```
   DO_SPACES_KEY=tu-key
   DO_SPACES_SECRET=tu-secret
   DO_SPACES_BUCKET=nombre-del-bucket
   DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
   DO_SPACES_REGION=nyc3
   ```
   (Cambia `nyc3` si tu Space está en otra región.)
5. Guarda y ejecuta el script como en el paso 5 de la Opción A.

## Uso del script

```bash
cd domus-beta-dbe
node scripts/upload-backup-to-spaces.mjs [ruta-del.tar.gz]
```

- Si pasas una ruta, sube ese archivo.
- Si no pasas nada, usa el último `domus-plus-respaldo-*.tar.gz` que encuentre en tu Escritorio.

El objeto quedará en el Space en: `backups/domus-plus/nombre-del-archivo.tar.gz`.
