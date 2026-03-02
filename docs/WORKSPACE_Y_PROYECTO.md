# Workspace y estructura del proyecto

## Ruta del workspace

El proyecto está en tu máquina en:

**`/Users/gonzalomontanofimbres/domus-plus`** (repositorio raíz)

Abre siempre este workspace para trabajar en Domus+. Si otro chat o la IA dice que "no encuentra el proyecto", pide que **cambie al path anterior** o que abra la carpeta `domus-plus`.

## Estructura principal (carpetas que debes ver)

En la raíz del repo deberías ver, entre otras:

| Carpeta | Descripción |
|---------|-------------|
| **domus-beta-dbe/** | Frontend principal (Next.js). Es el que debe desplegarse en **domus-fam.com** (Root Directory en Vercel = `domus-beta-dbe`). Incluye el diagrama de arquitectura en `/ui/system-architecture`. |
| **frontend/** | Otro frontend Next.js (por ejemplo para otro dominio o entorno). |
| **mobile/** | App móvil con Expo. |
| **supabase/** | Configuración, migraciones y esquema de Supabase. |
| **app/** | App Next.js en la raíz (si se usa el monorepo desde la raíz). |
| **backend/** | Backend (Node/API). |
| **docs/** | Documentación del proyecto. |

## Comprobar que estás en el workspace correcto

1. Workspace abierto: **`/Users/gonzalomontanofimbres/domus-plus`**.
2. Verificar que existan carpetas como `domus-beta-dbe`, `frontend`, `mobile`, `supabase`, etc.

Si no ves esas carpetas, estás en otro workspace (por ejemplo solo dentro de `frontend/` o `domus-beta-dbe/`). Cambia a la raíz del repo: **domus-plus**.

**Si en otro chat la IA dice que "no encuentra el proyecto":** pide que abra el workspace **`/Users/gonzalomontanofimbres/domus-plus`** y que compruebe que ve carpetas como domus-beta-dbe, frontend, mobile, supabase. Si sigue fallando, está en un workspace distinto; que cambie al path anterior.

## Página del diagrama (una sola fuente)

La página **Arquitectura del sistema** (`/ui/system-architecture`) existe en tres apps (domus-beta-dbe, app, frontend) pero **solo se edita en un sitio**:

- **Fuente canónica:** `domus-beta-dbe/src/app/ui/system-architecture/page.tsx`
- Después de cambiar ese archivo, ejecuta desde la raíz: **`npm run sync:diagram`** para copiar el contenido a `app/` y `frontend/`.
