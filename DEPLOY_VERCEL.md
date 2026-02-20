# Desplegar a Vercel desde GitHub Actions

Este repo tiene un workflow que despliega **desde la raíz** (incluye `/api/version` y `/budget-overview`) cada vez que haces push a `main`.

## Qué necesitas (solo una vez)

### 1. Token de Vercel

1. Entra en https://vercel.com/account/tokens  
2. Crea un token (nombre ej. `github-actions`)  
3. Copia el valor

### 2. Org ID y Project ID de Vercel

**Opción A – Desde el dashboard**

1. Vercel → proyecto **domus-plus** → **Settings** → **General**  
2. En **Project ID** copia el valor (es el **Project ID**)  
3. En la URL del proyecto suele verse el team/org; el **Org ID** a veces está en **Settings** del equipo o en la respuesta de la API.  

**Opción B – Desde tu máquina (más fácil)**

1. En tu repo, en la **raíz** del proyecto (donde está `package.json` de Next), ejecuta:  
   `npx vercel link`  
2. Elige el equipo y el proyecto **domus-plus**  
3. Se crea la carpeta `.vercel`. Abre `.vercel/project.json`  
4. Ahí verás `orgId` y `projectId` (esos son **VERCEL_ORG_ID** y **VERCEL_PROJECT_ID**)

### 3. Añadir los secretos en GitHub

1. Repo en GitHub → **Settings** → **Secrets and variables** → **Actions**  
2. **New repository secret** para cada uno:
   - `VERCEL_TOKEN` = el token que copiaste  
   - `VERCEL_ORG_ID` = el `orgId` de `.vercel/project.json` (o del dashboard)  
   - `VERCEL_PROJECT_ID` = el `projectId` de `.vercel/project.json` (o de Project Settings)

## Qué pasa después

- Cada **push a `main`** ejecuta el workflow **Deploy to Vercel (Production)**.  
- El despliegue usa la **raíz del repo** (`working-directory: .`), así que se construye la app con `app/`, `package.json`, etc., y quedan disponibles `/api/version` y `/budget-overview`.

## En Vercel

- **Root Directory** debe estar **vacío** (o el deploy desde GitHub Actions usará la raíz de todos modos).  
- El dominio **domus-fam.com** debe estar asignado a este proyecto en **Settings → Domains**.
