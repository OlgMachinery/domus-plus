# Exportar el proyecto limpio para otro equipo o proyecto

Se exporta **casi todo** el proyecto; solo se excluyen archivos que pueden contener API keys o secretos (`.env`, `.env.local`, etc.).

## Script automático

Desde la raíz del repo **domus-plus**:

```bash
# Crear el paquete en el directorio actual
bash domus-beta-dbe/scripts/export-clean.sh

# O en una carpeta concreta
bash domus-beta-dbe/scripts/export-clean.sh ~/Descargas
```

Se genera **`domus-beta-dbe-clean-YYYYMMDD.tar.gz`**.

### En el otro proyecto

```bash
tar xzf domus-beta-dbe-clean-YYYYMMDD.tar.gz
cd domus-beta-dbe
cp .env.example .env
# Editar .env: DATABASE_URL y JWT_SECRET (sin subir API keys al repo)
npm run dev
```

No hace falta `npm install` ni `prisma generate` si ya vienen `node_modules` y el cliente Prisma en el paquete.

## Qué se excluye (solo secretos)

- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- `.env.test`

**`.env.example` sí se incluye** (plantilla sin claves).

## Qué se incluye (todo lo demás)

- Código fuente (`src/`, `prisma/`, etc.)
- `node_modules`
- `.next` (build de Next.js)
- `package.json`, `package-lock.json`
- Base de datos local (`prisma/dev.db`) si existe
- `deploy/`, `docs/`, `scripts/`
- Cualquier otro archivo que no sea un `.env` con secretos

## Opción alternativa: solo código (git archive)

Si prefieres un paquete **sin** `node_modules` ni `.next` (más pequeño) y en el otro proyecto harás `npm install`:

```bash
cd /ruta/a/domus-plus
git archive --format=zip -o domus-beta-dbe-src.zip HEAD:domus-beta-dbe
```
