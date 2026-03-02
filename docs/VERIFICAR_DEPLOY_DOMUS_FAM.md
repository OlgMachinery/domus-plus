# Si domus-fam.com/diagrama sigue mostrando `{"message": "Hello diagrama!"}`

En el código **ya no existe** ninguna ruta que devuelva ese JSON (se eliminó `app/[slug]/route.ts`). Si lo sigues viendo, **el sitio está sirviendo un deploy antiguo o otro proyecto**.

## 1. Comprobar qué está desplegado

Abre en el navegador:

**https://domus-fam.com/api/build-info**

- **Si ves** `{"build":"diagrama-ok","slugRemoved":true,"project":"domus-beta-dbe"}`  
  → El deploy es el correcto. Entonces el problema es **caché**: prueba en ventana de incógnito o borra caché del sitio para domus-fam.com y vuelve a abrir `/diagrama`.

- **Si da 404 o otra respuesta**  
  → El dominio **no** está sirviendo el proyecto `domus-beta-dbe`. Sigue al paso 2.

## 2. En Vercel: qué proyecto usa el dominio

1. Entra a **https://vercel.com** e inicia sesión.
2. Lista de proyectos: busca el que tenga el dominio **domus-fam.com** (en Settings → Domains del proyecto).
3. En ese proyecto:
   - **Settings → General → Root Directory**  
     Debe ser **`domus-beta-dbe`** (o vacío si el repo solo tiene esa carpeta).  
     Si pone otra cosa (por ejemplo `frontend` o vacío en un monorepo con varias apps), ese proyecto construye otra app y por eso no ves los cambios.
   - **Deployments**  
     El último deployment debe ser de la rama **main** y del **mismo repositorio** que estás editando. Clic en el deployment y revisa el commit; debe ser el que eliminó `[slug]` (mensaje tipo "eliminar ruta [slug]").

## 3. Corregir y volver a desplegar

- Si **Root Directory** no es `domus-beta-dbe`:  
  **Settings → General → Root Directory** → pon **`domus-beta-dbe`** → Save.

- Después: **Deployments** → en el último deployment, menú **⋯** → **Redeploy** (marca “Redeploy with existing Build Cache” o sin caché si quieres estar seguro).

- Espera a que termine el build y prueba de nuevo:
  1. **https://domus-fam.com/api/build-info** (debe devolver `diagrama-ok`).
  2. **https://domus-fam.com/diagrama** (debe mostrar el diagrama, no el JSON).

## 4. Caché

Si **build-info** ya responde bien pero **/diagrama** sigue mostrando el JSON:

- Prueba **ventana de incógnito**.
- O en Chrome: DevTools (F12) → pestaña Network → marca “Disable cache” y recarga.
- O borra datos del sitio para domus-fam.com (configuración del navegador).

---

Resumen: el código está corregido; si el problema continúa, es **configuración del proyecto en Vercel** (Root Directory + qué proyecto tiene el dominio) o **caché**. Usa **/api/build-info** para saber si el deploy es el correcto.
