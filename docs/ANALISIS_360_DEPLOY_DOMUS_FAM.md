# Análisis 360: por qué no se ven los cambios en domus-fam.com

## Resumen del problema

Se hicieron cambios en el código (mensaje verde "Versión correcta (prueba)", borde del diagrama sin rojo) pero en **domus-fam.com** no se ven. Este doc recorre todo el flujo para localizar el fallo.

---

## 1. Dónde está el sistema (3 lugares)

| Lugar | Ruta en repo | Dashboard / UI |
|-------|----------------|----------------|
| **domus-beta-dbe** | `domus-beta-dbe/` | Una sola página grande con sidebar "NAVEGACIÓN", "Dashboard", "Arquitectura", "Overview financiero (estilo SAP-Family)". |
| **app (raíz)** | `app/`, `package.json` en raíz | Next con `/dashboard`, `/login`; layout con Cards, sin sidebar "NAVEGACIÓN". |
| **frontend** | `frontend/` | Next con `/dashboard`, `/setup`; layout con Cards, SAPLayout. |

Si en domus-fam.com ves **"NAVEGACIÓN"** y **"Overview financiero (estilo SAP-Family)"** → el sitio está sirviendo **domus-beta-dbe**.  
Si ves otro layout (solo Cards, sin ese sidebar) → está sirviendo **app** (raíz) o **frontend**.

---

## 2. Cómo se despliega (GitHub Actions)

- **Workflow:** `.github/workflows/deploy-vercel.yml`
- **Se dispara:** en cada `push` a la rama `main`.
- **Qué envía a Vercel:** todo el repo desde la **raíz** (`working-directory: .`).

Qué se construye en Vercel **no** lo decide el workflow, sino la **configuración del proyecto en Vercel**:

- **Root Directory vacío** → Vercel construye la **app de la raíz** (`app/`, `package.json` raíz).
- **Root Directory = `domus-beta-dbe`** → Vercel construye **domus-beta-dbe**.
- **Root Directory = `frontend`** → Vercel construye **frontend**.

Por tanto: el mismo push a `main` puede generar una u otra app según el **Root Directory** del proyecto que tenga asignado el dominio domus-fam.com.

---

## 3. Comprobar qué está sirviendo domus-fam.com

### Paso A: API de comprobación (solo existe en domus-beta-dbe)

Abre en el navegador:

**https://domus-fam.com/api/build-info**

- **Si ves JSON** tipo:  
  `{"build":"diagrama-ok","slugRemoved":true,"project":"domus-beta-dbe"}`  
  → El dominio está sirviendo el proyecto **domus-beta-dbe**. Si aun así no ves el mensaje verde, sigue siendo caché o un deployment antiguo (ver pasos 4 y 5).

- **Si da 404**  
  → El dominio **no** está sirviendo domus-beta-dbe; está sirviendo la app de **raíz** o **frontend**. Hay que cambiar en Vercel el proyecto que tiene el dominio o su Root Directory (ver sección 6).

### Paso B: Señal en la página del diagrama

Abre: **https://domus-fam.com/ui/system-architecture?signal=1**

- Si aparece una barra azul con **"✓ Estás viendo el build correcto: domus-beta-dbe (diagrama-ok)"** → estás en domus-beta-dbe.
- Si no aparece → o es otro proyecto, o un build antiguo/caché.

---

## 4. Caché (navegador y CDN)

- Prueba en **ventana de incógnito** o con **"Reinicia para actualizar"** si el navegador lo muestra.
- En DevTools (F12) → pestaña **Network** → marcar **Disable cache** y recargar.
- En Vercel: **Deployments** → último deployment → **⋯** → **Redeploy** y, si existe, **Redeploy without cache**.

---

## 5. Estado del repo y últimos commits

Los cambios del mensaje verde están en:

- **domus-beta-dbe:** `domus-beta-dbe/src/app/ui/page.tsx` (pill verde en el `sectionRow` del Dashboard).
- **app:** `app/dashboard/page.tsx` (pill verde junto al título Dashboard).
- **frontend:** `frontend/app/dashboard/page.tsx` (pill verde junto al título).

Para que un cambio aparezca en producción:

1. El archivo debe estar **commiteado y en `main`**.
2. El **workflow de deploy** debe haberse ejecutado (revisar en GitHub → Actions).
3. El **proyecto de Vercel** que tiene domus-fam.com debe tener el **Root Directory correcto** (ver siguiente sección).
4. No debe estar sirviendo un deployment antiguo por caché (ver sección 4).

---

## 6. Qué revisar en Vercel

1. Entra en **https://vercel.com** y abre el proyecto que tiene el dominio **domus-fam.com** (Settings → Domains).
2. **Settings → General → Root Directory:**
   - Si quieres que domus-fam.com sea la app con "NAVEGACIÓN" y diagrama → debe ser **`domus-beta-dbe`**.
   - Si está vacío, Vercel construye la app de la **raíz** (otra UI).
   - Si pone **`frontend`**, construye la app de frontend (otra UI).
3. **Deployments:** el último deployment debe ser de la rama **main** y del **mismo repositorio** que estás editando. Revisa el commit; debe ser reciente (p. ej. el que añade el mensaje verde).
4. Si cambias **Root Directory**, guarda y haz **Redeploy** (y opcionalmente sin caché).

---

## 7. Checklist rápido

- [ ] Abrir **https://domus-fam.com/api/build-info** → ¿JSON con `project: "domus-beta-dbe"` o 404?
- [ ] Abrir **https://domus-fam.com/ui** en incógnito → ¿Ves el mensaje verde "✓ Versión correcta (prueba)"?
- [ ] En GitHub → **Actions** → último "Deploy to Vercel" → ¿Completado en verde? ¿Commit reciente?
- [ ] En Vercel → proyecto con domus-fam.com → **Root Directory** = `domus-beta-dbe`?
- [ ] En Vercel → **Deployments** → último deployment → ¿Commit = último de `main`?
- [ ] Si todo lo anterior está bien y sigue sin verse el mensaje → **Redeploy** sin caché y probar de nuevo en incógnito.

---

## 8. Conclusión

El código del mensaje verde y del borde del diagrama está en el repo (en los 3 lugares). Si no se ve en domus-fam.com, la causa suele ser una de estas:

1. **Root Directory en Vercel** no es `domus-beta-dbe` (y por tanto se construye otra app).
2. **El dominio** está asignado a otro proyecto de Vercel que no se despliega con este repo.
3. **Caché** (navegador o CDN) o **deployment antiguo** aún en producción.
4. **El último deploy** falló y no hay build nuevo.

Usar **/api/build-info** y la lista de comprobación de la sección 7 suele bastar para acotar el problema.
