# Verificar deploy en domus-fam.com (domus-beta-dbe)

## Para que no vuelva a pasar: checklist

1. **Bloquear el root en Vercel**  
   Deja fijo **Root Directory = `domus-beta-dbe`** en el proyecto de Vercel que usa **domus-fam.com**. No cambies de proyecto/dominio sin actualizar ese ajuste.

2. **Protección con “señal”**  
   Mantén la barra/verificación (o `/api/build-info`) y **comprueba tras cada deploy** que se ve en producción (ver pasos abajo).

3. **Revisar deployments**  
   Antes de anunciar cambios, confirma en Vercel que el **deploy activo** corresponde al repo/carpeta correcta; evita conectar el dominio a proyectos duplicados.

4. **Cachés**  
   Tras redeploy, prueba en **incógnito** u otra red para evitar caché del navegador/CDN.

5. **Documentar la ruta**  
   Este doc (`docs/VERIFICAR_DEPLOY_DOMUS_FAM.md`) es la referencia para validar la señal y el Root Directory en Vercel.

---

## Cómo validar que producción = código del repo

Así compruebas que lo que está en Vercel es exactamente lo que tienes en el repo.

### 1. Versión en el repo (tu código actual)

En tu máquina, en el repo:

```bash
grep -n "BUILD_VERSION" domus-beta-dbe/src/app/api/build-info/route.ts
```

Debe salir algo como: `BUILD_VERSION = '2026-02-26-reticula-teal'` (o la versión que hayas puesto). **Esa es la versión “fuente de verdad”** del repo.

### 2. Versión en producción (lo que sirve domus-fam.com)

Abre en el navegador o ejecuta:

```bash
curl -s https://domus-fam.com/api/build-info | jq -r '.version'
```

(o abre https://domus-fam.com/api/build-info y mira el campo `"version"` en el JSON).

### 3. Comparar

| Situación | Conclusión |
|-----------|------------|
| **Producción** `version` **=** valor en el repo (ej. `2026-02-26-reticula-teal`) | El deploy está al día. Si la UI no cambia, suele ser caché (prueba incógnito). |
| **Producción** `version` **≠** valor en el repo (ej. producción `2026-03-02-verde-sin-borde`) | Producción tiene un **build antiguo**. Falta push y/o redeploy para que se suba el código nuevo. |

### 4. Comprobar que el código de la UI está en el repo (opcional)

Para asegurarte de que los cambios de UI (marco teal, retícula) están en el código:

```bash
grep -n "0f766e\|Retícula con letras" domus-beta-dbe/src/app/ui/system-architecture/page.tsx
```

Si ves líneas con `#0f766e` y el comentario de la retícula, ese código está en el repo. Cuando la **versión** de producción coincida con la del repo, ese código es el que se está sirviendo.

---

## 1. Comprobar qué está desplegado

### A) API de build

Abre: **https://domus-fam.com/api/build-info**

- **Si ves** algo como:  
  `{"build":"diagrama-ok","slugRemoved":true,"project":"domus-beta-dbe","version":"2026-02-26-reticula-teal",...}`  
  → El deploy es el correcto. Si la UI no se actualiza, prueba incógnito/sin caché.

- **Si da 404**  
  → El dominio **no** está sirviendo el proyecto `domus-beta-dbe`. Ve al apartado 2.

### B) Señal visual en la página del diagrama

Abre: **https://domus-fam.com/ui/system-architecture?signal=1**

- **Si ves** la barra que indica el build correcto (domus-beta-dbe / diagrama-ok)  
  → Estás en el build correcto. Deberías ver también el **marco teal** y la **retícula con letras y números** en el canvas.

- **Si no ves esa barra** (o ves la UI antigua con Opciones avanzadas, Zoom, marco azul, sin retícula)  
  → El dominio está sirviendo otro proyecto o un build antiguo. Ve al apartado 2.

---

## 2. En Vercel: qué proyecto usa el dominio

1. Entra a **https://vercel.com** e inicia sesión.
2. Busca el proyecto que tenga el dominio **domus-fam.com** (Settings → Domains).
3. En ese proyecto:
   - **Settings → General → Root Directory**  
     Debe ser **`domus-beta-dbe`**.  
     Si está vacío, `frontend/` u otra carpeta, ese proyecto construye otra app y por eso no ves los cambios.
   - **Deployments**  
     El último deployment debe ser de **main** y del **mismo repositorio** que estás editando. Revisa el commit del deploy activo.

---

## 3. Corregir y volver a desplegar

- Si **Root Directory** no es `domus-beta-dbe`:  
  **Settings → General → Root Directory** → **`domus-beta-dbe`** → Save.

- Luego: **Deployments** → último deployment → menú **⋯** → **Redeploy**.  
  Opcional: desmarca “Use existing build cache” para forzar build limpio.

- Cuando termine el build:
  1. **https://domus-fam.com/api/build-info** → debe devolver `diagrama-ok` y el `version` actual.
  2. **https://domus-fam.com/ui/system-architecture?signal=1** → debe mostrar la barra de “build correcto” y la UI nueva (marco teal + retícula).

---

## 4. Si build-info ya responde bien pero la página no cambia

- Prueba en **ventana de incógnito**.
- O DevTools (F12) → Network → “Disable cache” y recarga.
- O borra datos del sitio para domus-fam.com.

---

**Resumen:** Si los cambios no llegan, suele ser **Root Directory en Vercel** (debe ser `domus-beta-dbe`) o **caché**. Usa **/api/build-info** y **?signal=1** para confirmar que el deploy es el correcto.
