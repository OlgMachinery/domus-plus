# Análisis detallado: 404 en /budget-overview y /api/version en producción

## Resumen

En el código **ambas rutas existen** y el **build desde la raíz del repo termina bien** e incluye `/api/version` y `/budget-overview`. El 404 en **domus-fam.com** no viene de que falten en el código, sino de **qué se está construyendo y sirviendo** en Vercel.

---

## 1. Estado del repositorio

### Dos “apps” Next.js en el mismo repo

| Ubicación | package.json | next.config | Rutas `/api/version` y `/budget-overview` |
|-----------|--------------|-------------|------------------------------------------|
| **Raíz**  | Sí (Next 16, scripts build/dev) | Sí | **Sí** – `app/api/version/route.ts`, `app/budget-overview/page.tsx` |
| **frontend/** | Sí (Next 14, mismos scripts) | Sí (con ignoreDuringBuilds/ignoreBuildErrors) | **Sí** – mismas rutas bajo `frontend/app/` |

- En **raíz**: `tsconfig.json` excluye `"frontend"` y `"domus-plus-codigo-completo"`, así que al construir desde raíz solo se compila la app de la raíz.
- **Raíz** tiene dependencias que **frontend** no tiene en su `package.json`: `@phosphor-icons/react`, `xlsx`. En **frontend**, `SAPLayout.tsx` usa `@phosphor-icons/react`; si en Vercel se hiciera `npm install` solo dentro de `frontend/`, podría fallar por dependencias faltantes (aunque localmente el build de frontend completó, posiblemente por `node_modules` ya instalados).

### Builds locales

- **Raíz** (`npm run build` en la raíz): **correcto**. Next 16.1.4, lista de rutas incluye `ƒ /api/version` y `○ /budget-overview`.
- **frontend** (`npm run build` en `frontend/`): **correcto**. Next 14.0.3, lista de rutas incluye `/api/version` y `/budget-overview`. Aparecen errores de “Dynamic server usage” durante la generación estática pero el build termina con exit 0.

Conclusión: en el repo, tanto la app de raíz como la de frontend tienen esas rutas y construyen.

---

## 2. Qué determina el 404 en producción

Vercel **no** “elige” solo por el código: usa la **configuración del proyecto** (dashboard) y el **estado de los deployments**. El 404 puede deberse a una sola causa o a la suma de varias.

### A) Root Directory en el proyecto de Vercel

- Si **Root Directory** está **vacío**: Vercel hace `npm install` y `npm run build` en la **raíz** del repo. La app desplegada es la de raíz (Next 16); en el código actual esa app incluye `/api/version` y `/budget-overview`.
- Si **Root Directory** = **`frontend`**: Vercel trabaja dentro de `frontend/`. La app desplegada es la de frontend (Next 14). En el código actual, esa app también tiene esas rutas.

Si en algún momento el proyecto se configuró con Root Directory = `frontend`, y luego se añadieron rutas solo en la raíz (o hubo un periodo en que frontend no las tenía), un deployment antiguo sin esas rutas pudo quedar como “último exitoso” y seguir sirviéndose.

### B) Fallo del build en Vercel

Si el **build en Vercel falla** (por env, versión de Node, memoria, dependencias, etc.), Vercel **no** actualiza el deployment de producción y sigue sirviendo el **último deployment exitoso**. Ese deployment pudo ser de hace tiempo y no incluir `/api/version` ni `/budget-overview`.

Posibles causas de fallo cuando se construye desde **raíz**:

- Variables de entorno requeridas en build time (p. ej. `NEXT_PUBLIC_*`) no definidas en el proyecto de Vercel.
- El `next.config.js` de la raíz **no** tiene `eslint.ignoreDuringBuilds` ni `typescript.ignoreBuildErrors`; un error de ESLint o TypeScript en build haría fallar el build.

Posibles causas cuando se construye desde **frontend**:

- Dependencias usadas en código pero no en `frontend/package.json` (p. ej. `@phosphor-icons/react`, `xlsx`) si en Vercel se instala solo con `frontend/package.json`.
- Mismas variables de entorno si las rutas o el layout las necesitan en build.

### C) Dominio de producción y deployment asignado

- **domus-fam.com** puede estar asignado a un **deployment concreto** (por ejemplo, uno antiguo).
- O el dominio puede estar en otro **proyecto** de Vercel.
- O “Production” en Vercel no es el deployment que se generó con el último push a `main`.

En cualquiera de esos casos, aunque el último build sea correcto y tenga las rutas, el tráfico seguiría yendo a un deployment viejo → 404.

### D) Repo, rama o commit que construye Vercel

- Si el proyecto de Vercel está conectado a **otro repo**, **fork** o **rama** (p. ej. no `main`), el código que se construye puede no ser el que tiene `/api/version` y `/budget-overview`.
- Si por algún motivo se despliega un **commit antiguo**, el build correspondiente a ese commit puede no incluir esas rutas.

---

## 3. Qué no es el problema

- **Código**: Las rutas existen en raíz y en frontend; no hay eliminación ni rutas condicionales que las oculten.
- **Configuración local**: No hay `rewrites`/`redirects` en `next.config.js` ni en `vercel.json` que quiten o redirijan esas rutas.
- **Git**: Esas rutas están en el árbol del repo (en `app/` y en `frontend/app/`); no están en `.gitignore` ni en ningún ignore que impida subirlas.

---

## 4. Conclusión del análisis

El 404 en **domus-fam.com** para `/budget-overview` y `/api/version` **no** se debe a que falten en el código, sino a **qué se está construyendo y qué deployment está sirviendo el dominio**:

1. **Root Directory** del proyecto en Vercel (vacío vs `frontend`) decide qué app se construye.
2. Si el **build en Vercel falla**, se sigue sirviendo un deployment anterior, que puede no tener esas rutas.
3. El **dominio de producción** puede no estar apuntando al deployment más reciente (o al proyecto correcto).
4. El **repo/rama/commit** desde el que Vercel construye puede no ser el que tiene estas rutas.

Para resolverlo hace falta comprobar en el **dashboard de Vercel** (y, si aplica, en GitHub): Root Directory, estado de los últimos builds, a qué deployment está asignado el dominio de producción y desde qué rama/commit se está desplegando. El siguiente paso es revisar esa configuración y, si quieres, aplicar cambios concretos en repo o en Vercel según lo que encuentres.
