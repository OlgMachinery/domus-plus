# Si domus-fam.com da 404 o ves la vista antigua del diagrama

## 1. URL que debes usar (vista compacta móvil)

**Usa esta URL:**

- **https://domus-fam.com/diagrama**

Esta ruta solo existe en el código actual. Las URLs antiguas redirigen aquí:

- `/ui/system-a` → `/diagrama`
- `/ui/system-architecture` → `/diagrama`
- `/ui/syster` → `/diagrama`

Si escribes cualquier variante anterior, el servidor te lleva a **/diagrama**. Si ves 404 o la vista antigua (muchos botones, “Opciones avanzadas”, scroll), sigue los pasos siguientes.

## 2. Confirmar qué construye Vercel

En **Vercel** → proyecto que tiene el dominio **domus-fam.com**:

1. **Settings** → **General** → **Root Directory**
   - Si está **vacío**: se construye la **raíz** del repo (`package.json` y `app/` de la raíz). La ruta `/ui/system-architecture` está en `app/ui/system-architecture/page.tsx`.
   - Si pone **`frontend`**: se construye la carpeta **frontend** (`frontend/package.json`, `frontend/app/`). La ruta está en `frontend/app/ui/system-architecture/page.tsx`.

En ambos casos la ruta existe en el repo. Si ves 404:

- Asegúrate de que el **último deployment** es de la rama **main** y que incluye los commits que añadieron esta página (por ejemplo el que dice "vista diagrama" o "fix: vista diagrama compacta en frontend").
- En **Deployments** → último deployment → pestaña **Building**: revisa que el build termina bien y que no hay errores.

## 3. Redeploy

1. **Deployments** → en el último deployment, menú **⋯** → **Redeploy**.
2. Opción **Redeploy with existing Build Cache** está bien; si quieres estar seguro, quita la caché.
3. Cuando termine, prueba de nuevo: **https://domus-fam.com/ui/system-architecture**.

## 4. Caché y dispositivo

- Prueba en **ventana de incógnito** o borrando caché del sitio.
- Si usas un enlace guardado, asegúrate de que es exactamente `https://domus-fam.com/ui/system-architecture` (sin typo como "syster").

## Resumen

| Root Directory en Vercel | Dónde está la página en el repo |
|--------------------------|----------------------------------|
| Vacío                    | `app/ui/system-architecture/page.tsx` |
| `frontend`               | `frontend/app/ui/system-architecture/page.tsx` |

Ambas existen. El 404 suele deberse a deployment antiguo, build fallido o URL con typo; los redirects corrigen `/ui/syster` y `/ui/system-a`.
