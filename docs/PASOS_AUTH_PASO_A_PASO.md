# Pasos para dejar el login funcionando — Dónde está cada cosa y cómo hacerla

Cada paso indica **dónde** está la cosa y **cómo** hacerla. Sigue el orden.

---

## PARTE 1: Desarrollo local (tu computadora)

---

### Paso 1 — Dónde y cómo abrir Supabase

| Qué | Dónde | Cómo |
|-----|--------|------|
| Supabase | En el navegador | Escribe en la barra de direcciones: **https://supabase.com** y pulsa Enter. |
| Iniciar sesión | En esa misma página | Si no estás logueado, haz clic donde diga "Sign in" o "Log in" y entra con tu cuenta. |
| Tu proyecto | En el panel de Supabase | En la lista de proyectos (página principal tras entrar), haz **clic en el nombre del proyecto** que usa esta app (DOMUS+). Se abrirá el panel del proyecto. |

---

### Paso 2 — Dónde y cómo copiar las 3 variables

| Qué copiar | Dónde está en Supabase | Cómo copiarlo |
|------------|------------------------|----------------|
| **Project URL** | En el **menú lateral izquierdo** (barra vertical): abajo suele estar **"Project Settings"** (icono de engrane ⚙️). Haz clic ahí. Luego en el **submenú de la izquierda** haz clic en **"API"**. En la página que se abre, **arriba** verás un bloque que dice **"Project URL"** y al lado un texto largo que empieza por `https://` y termina en `.supabase.co`. | Haz clic en el **botón "Copy"** que está a la derecha de ese texto (o selecciona todo el texto con el ratón y Cmd+C / Ctrl+C). |
| **anon key** | En la **misma página API**, baja. Verás una zona con pestañas o secciones. Busca la que diga **"Legacy API Keys"** o **"Project API keys"** y haz clic en ella. Ahí hay **dos** claves largas que empiezan por **`eyJ...`**. La que está etiquetada como **"anon"** o **"anon public"** (y **no** dice "secret") es la anon key. | Haz clic en el **botón "Copy"** al lado de esa clave (o selecciónala y Cmd+C / Ctrl+C). |
| **service_role key** | En esa **misma sección "Legacy API Keys"**, la **otra** clave larga que empieza por **`eyJ...`** está etiquetada como **"service_role"** y suele decir **"secret"**. Esa es la que necesitas. | Haz clic en el **botón "Copy"** al lado de esa clave (o selecciónala y Cmd+C / Ctrl+C). |

**Importante:** Si solo ves una clave que empieza por **`sb_secret_...`** y no una que empieza por **`eyJ...`** para service_role, en esa misma página busca otra pestaña o enlace que diga **"Legacy"** o **"JWT"** o **"Project API keys"**; la service_role en formato JWT (eyJ...) suele estar ahí.

Guarda las 3 en un bloc de notas temporal (no las compartas):  
1) URL, 2) anon key, 3) service_role key.

---

### Paso 3 — Dónde está el archivo .env.local y cómo editarlo

| Qué | Dónde está | Cómo hacerlo |
|-----|------------|--------------|
| El archivo | En **tu proyecto domus-plus**, dentro de la carpeta **`frontend`**. Ruta completa: **`domus-plus/frontend/.env.local`**. En Cursor/VS Code: en el explorador de archivos (barra lateral izquierda) abre la carpeta **frontend** y haz clic en **`.env.local`**. | Si no existe, créalo: clic derecho en **frontend** → New File → nombre: **`.env.local`**. |
| Las 3 líneas | Dentro de **`.env.local`** | Debe haber **exactamente 3 líneas** (o las que ya tengas más estas). **No** dejes espacios antes del `=`. **No** pongas comillas. **Una** variable por línea. Sustituye los valores por los que copiaste en el Paso 2. |
| Línea 1 — URL | Primera línea del archivo | Escribe: `NEXT_PUBLIC_SUPABASE_URL=` y **pegando justo después del =** la URL que copiaste (la que empieza por https:// y termina en .supabase.co). Ejemplo: `NEXT_PUBLIC_SUPABASE_URL=https://jtrqxzqztndhdwugsbpt.supabase.co` |
| Línea 2 — anon key | Segunda línea | Escribe: `NEXT_PUBLIC_SUPABASE_ANON_KEY=` y **pegando justo después del =** la anon key (la que empieza por eyJ... y es larga). Sin espacio ni comillas. |
| Línea 3 — service_role | Tercera línea | Escribe: `SUPABASE_SERVICE_ROLE_KEY=` y **pegando justo después del =** la service_role key (la que empieza por eyJ... y dice "secret"). Sin espacio ni comillas. |
| Guardar | En el editor | Menú **File → Save** o atajo **Cmd+S** (Mac) / **Ctrl+S** (Windows). |

Ejemplo de cómo puede quedar el archivo (con valores de ejemplo; los tuyos serán distintos):

```
NEXT_PUBLIC_SUPABASE_URL=https://jtrqxzqztndhdwugsbpt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...
```

---

### Paso 4 — Dónde y cómo reiniciar el servidor

| Qué | Dónde | Cómo |
|-----|--------|------|
| Terminal donde corre el servidor | La ventana de terminal donde ejecutaste `npm run dev` (o donde ves los logs de Next.js). | Si está corriendo: pulsa **Ctrl+C** (una vez). Eso detiene el servidor. |
| Carpeta correcta | En **esa misma** terminal (o en una nueva). | Escribe: `cd frontend` y pulsa Enter. Luego escribe: `npm run dev` y pulsa Enter. |
| Confirmación | En la salida de la terminal | Verás algo como: `Local: http://localhost:3000` (o `3001`). **Anota el número** (3000 o 3001): lo usarás en el siguiente paso. No cierres esta terminal. |

---

### Paso 5 — Dónde y cómo crear el usuario de prueba

| Qué | Dónde | Cómo |
|-----|--------|------|
| Otra terminal | Abre una **nueva** ventana/pestaña de terminal (o un nuevo terminal en Cursor). **No** cierres la que tiene `npm run dev` corriendo. | En Cursor: menú **Terminal → New Terminal**. O en Mac: Cmd+ espacio, escribe "Terminal", Enter, y abre otra ventana. |
| Comando | En esa nueva terminal | Escribe exactamente (sustituye 3000 por 3001 si ese es el puerto que anotaste): `curl -X POST http://localhost:3000/api/auth/seed-test-user` y pulsa Enter. |
| Resultado correcto | En la misma terminal, abajo del comando | Verás un texto en JSON con `"message": "Usuario admin de prueba listo..."`, `"email": "admin@domus.local"` y `"password": "Admin123!"`. Eso significa que el usuario se creó. |
| Si sale error "Invalid API key" | — | La clave de **SUPABASE_SERVICE_ROLE_KEY** no es la correcta: tiene que ser la **JWT** (eyJ...), no la sb_secret_.... Vuelve al **Paso 2** y copia la **service_role** de la sección **Legacy API Keys**. Luego **Paso 3** (pegar en .env.local), **Paso 4** (reiniciar servidor) y este paso otra vez. |

---

### Paso 6 — Dónde y cómo entrar en la app

| Qué | Dónde | Cómo |
|-----|--------|------|
| Abrir la app | En el **navegador** (Chrome, Safari, etc.) | En la barra de direcciones escribe: **http://localhost:3000** (o **http://localhost:3001** si ese es tu puerto) y pulsa Enter. |
| Ir al login | En la misma ventana | Si no te lleva solo, haz clic en **Login** o escribe en la barra: **http://localhost:3000/login** (o 3001). |
| Email | En el campo "Email" del formulario de login | Escribe exactamente: **admin@domus.local** |
| Contraseña | En el campo "Password" o "Contraseña" | Escribe exactamente: **Admin123!** |
| Entrar | Botón de enviar del formulario | Haz clic en **"Sign In"** o **"Iniciar sesión"**. Si todo está bien, entrarás al dashboard o al setup. |

---

## PARTE 2: Producción (Vercel) — cuando quieras desplegar

---

### Paso 1 — Dónde y cómo subir el código

| Qué | Dónde | Cómo |
|-----|--------|------|
| Terminal | En la raíz del proyecto (carpeta **domus-plus**), en cualquier terminal. | `cd` hasta la carpeta **domus-plus** si no estás. Luego: `git add .` Enter. `git commit -m "Configuración auth y seed"` Enter. `git push origin main` Enter. (Cambia **main** por la rama que use Vercel si es otra.) |

---

### Paso 2 — Dónde y cómo poner las variables en Vercel

| Qué | Dónde en Vercel | Cómo |
|-----|------------------|------|
| Ir a Vercel | Navegador | Abre **https://vercel.com**, inicia sesión. |
| Tu proyecto | En el dashboard de Vercel | Haz clic en el **nombre del proyecto** (ej. domus-plus). |
| Settings | Arriba en la página del proyecto | Haz clic en la pestaña **"Settings"**. |
| Environment Variables | En el menú lateral izquierdo de Settings | Haz clic en **"Environment Variables"**. |
| Añadir cada variable | En la zona "Key" y "Value" | Para **cada una** de las 3: en **Key** escribe el **Name** exacto (abajo). En **Value** pega el **valor** (el mismo que en tu .env.local). En **Environment** marca **Production**. Luego clic en **"Save"** o **"Add"**. |
| Names exactos | — | 1) **NEXT_PUBLIC_SUPABASE_URL** — Value: la URL de Supabase. 2) **NEXT_PUBLIC_SUPABASE_ANON_KEY** — Value: la anon key. 3) **SUPABASE_SERVICE_ROLE_KEY** — Value: la service_role (JWT). |

---

### Paso 3 — Dónde y cómo decirle a Supabase tu dominio

| Qué | Dónde en Supabase | Cómo |
|-----|--------------------|------|
| Authentication | Menú lateral izquierdo del proyecto | Haz clic en **"Authentication"**. |
| URL Configuration | En el submenú de Authentication (o en la parte superior de la página) | Haz clic en **"URL Configuration"**. |
| Site URL | Campo "Site URL" en esa página | Escribe tu dominio de producción, por ejemplo: **https://domus-fam.com** (sin barra al final). |
| Redirect URLs | Campo "Redirect URLs" (lista o cuadro de texto) | Añade esta línea: `https://domus-fam.com/**` (con la barra final y los dos asteriscos). Si ya hay otras URLs, añade esta en una nueva línea. |
| Guardar | Botón en la misma página | Haz clic en **"Save"** o **"Update"**. |

---

### Paso 4 — Dónde y cómo volver a desplegar en Vercel

| Qué | Dónde en Vercel | Cómo |
|-----|------------------|------|
| Deployments | En el proyecto, barra superior | Haz clic en la pestaña **"Deployments"**. |
| Último deployment | Lista de deployments (el primero suele ser el más reciente) | En la fila del **último** deployment, a la **derecha**, verás **tres puntos** (⋯) o un menú. Haz clic ahí. |
| Redeploy | En el menú que se abre | Haz clic en **"Redeploy"**. Confirma si te lo pide. |
| Esperar | En la misma página | Espera a que el estado pase a **"Ready"** o **"Completed"**. Después de eso, el login en tu dominio de producción debería funcionar. |

---

## Resumen: qué es cada cosa

| Cosa | Qué es | Dónde está / cómo |
|------|--------|--------------------|
| **Project URL** | La URL pública de tu proyecto Supabase | Supabase → Project Settings → API → arriba, "Project URL" → Copy. |
| **anon key** | Clave pública para el navegador y login | Supabase → Project Settings → API → Legacy API Keys → la clave "anon" (eyJ...) → Copy. |
| **service_role key** | Clave secreta para el servidor (crear usuarios, etc.) | Supabase → Project Settings → API → Legacy API Keys → la clave "service_role" (eyJ...) → Copy. |
| **.env.local** | Archivo donde guardas las 3 variables en tu máquina | Carpeta **frontend** del proyecto, archivo **.env.local**. |
| **seed-test-user** | Comando que crea el usuario admin@domus.local | En terminal: `curl -X POST http://localhost:3000/api/auth/seed-test-user` (o 3001). |
| **Login en local** | Página para entrar en tu app en tu computadora | Navegador: **http://localhost:3000/login** (o 3001). Usuario: **admin@domus.local**, contraseña: **Admin123!**. |
| **Variables en Vercel** | Donde Vercel guarda URL y claves en producción | Vercel → tu proyecto → **Settings** → **Environment Variables** → añadir las 3. |
| **Redeploy** | Volver a construir y publicar la app en Vercel | Vercel → **Deployments** → ⋯ del último → **Redeploy**. |

Con esto tienes **dónde** está cada cosa y **cómo** hacerla.
