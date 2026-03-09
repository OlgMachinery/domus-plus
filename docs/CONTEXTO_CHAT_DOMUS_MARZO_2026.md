# Contexto para nuevo chat — DOMUS+ (marzo 2026)

Documento para **mudar a otro chat** sin perder contexto. Usar íntegro al iniciar el nuevo chat para evitar desvíos, problemas y equivocaciones.

---

## 1. Estructura del repo

- **Workspace:** `domus-plus` (raíz del repo).
- **App en producción (la que importa para domus-fam.com):** `domus-beta-dbe/`
  - Next.js 16, Prisma (SQLite en prod: `DATABASE_URL` o `file:./prisma/dev.db`).
  - Una sola UI: `domus-beta-dbe/src/app/ui/page.tsx` (página enorme con todas las vistas: Dashboard, Presupuesto, Transacciones, **Usuarios**, Reportes, Configuración).
  - API bajo `domus-beta-dbe/src/app/api/`.
- **Frontend alternativo (Supabase):** `frontend/` — registro con Supabase Auth; puede usarse en paralelo. No es el que sirve domus-fam.com/ui.
- **Otros:** `app/`, `domus-wireframe/`, `supabase/`, `backend/` (Python), etc. No confundir con `domus-beta-dbe`.

---

## 2. Despliegue actual (VPS)

- **URL pública:** https://domus-fam.com  
- **Host:** `187.77.16.4`  
- **Ruta en servidor:** `/srv/domus/app`  
- **Servicio systemd:** `domus-beta`  
- **Usuario que corre el servicio:** `deploy` (el script hace `chown -R deploy:deploy` tras el build).

**Comando de deploy (ejecutar desde tu máquina):**

```bash
cd /Users/gonzalomontanofimbres/domus-plus/domus-beta-dbe
export DOMUS_VPS_HOST=187.77.16.4
export DOMUS_DEPLOY_USER=deploy
SSH_OPTS="-i $HOME/.ssh/id_ed25519_domus" ./deploy/deploy-vps.sh --chown deploy
```

El script: rsync del proyecto → en remoto `npm ci` → `next build` → `chown -R deploy:deploy` → `prisma db push --accept-data-loss` → restart de `domus-beta` → chequeo de `https://domus-fam.com/api/build-info`.

**Importante:** En la VPS el `.env` **no** se sube por rsync (está en EXCLUDES). Las variables de entorno deben estar configuradas en el servidor (systemd o archivo que cargue el servicio).

---

## 3. Variables de entorno (domus-beta-dbe en producción)

Configurar en la VPS (servicio `domus-beta`):

| Variable | Uso |
|--------|-----|
| `DATABASE_URL` | SQLite en prod, ej. `file:/srv/domus/app/prisma/dev.db` (o la ruta que use el servicio). |
| `JWT_SECRET` | Sesión y cookies de auth. |
| `TWILIO_ACCOUNT_SID` | Twilio. |
| `TWILIO_AUTH_TOKEN` | Twilio. |
| `TWILIO_WHATSAPP_NUMBER` | Ej. `whatsapp:+14155238886` (número del Sandbox de Twilio). |
| `OPENAI_API_KEY` | Opcional: OCR de fotos de recibos y webhook WhatsApp con imagen. |
| `OPENAI_RECEIPT_MODEL` | Opcional; default `gpt-4o-mini`. |
| `DO_SPACES_ENDPOINT`, `DO_SPACES_REGION`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET` | Opcional: DigitalOcean Spaces para subir imágenes de recibos. |

Si faltan Twilio, el mensaje en la UI será: "No se pudo enviar (revisa TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)".

---

## 4. Twilio Sandbox (obligatorio para WhatsApp)

Para que un número reciba/envíe mensajes con el webhook:

1. En Twilio Console: **Messaging → Try it out → Send a WhatsApp message** (o equivalente).
2. Ver el **número de WhatsApp** de Twilio (ej. +1 415 523 8886) y la frase **`join <sandbox name>`** (ej. `join red-mountain`).
3. Desde el **WhatsApp del usuario** (ej. +52 1 686 569 0472), crear chat con ese número de Twilio y enviar **solo** esa frase (ej. `join red-mountain`).
4. Twilio confirma. La membresía dura 72 h; se puede reenviar `join ...` cuando caduque.

El aviso "Your number whatsapp:+5216865690472 is not connected to a Sandbox" se resuelve **solo** haciendo ese `join` desde ese número; no es un bug de la app.

---

## 5. Qué se hizo en este chat (resumen preciso)

- **Modal “Integrantes (presupuesto individual)”**  
  - Scroll cuando haga falta: `.peopleStudioBody` con `overflow-y: auto`.  
  - Sidebar izquierdo más profesional: estilos en `domus-beta-dbe/src/app/globals.css` (`.peopleStudioSidebar`, `.peopleList`, `.peopleListItem`, etc.).

- **Registro de usuario**  
  - En **domus-beta-dbe**: formulario "Crear cuenta" en la misma UI (`page.tsx`) cuando no hay sesión: campos **Nombre, Email, Teléfono, Ciudad, ¿Perteneces a una familia?, Contraseña, Nombre de familia (opcional)**.  
  - API `POST /api/auth/register` en `domus-beta-dbe`: exige teléfono (mín. 10 dígitos), acepta `city`; crea User + Family; modelo User tiene `phone` y `city` en Prisma.

- **Usuarios (editar y Probar Twilio)**  
  - Vista **Usuarios** (menú lateral): tabla con **Nombre, Email, Teléfono, Ciudad, Admin, Acciones**.  
  - El usuario puede **editar su propia fila** (nombre, teléfono, ciudad) y pulsar **Guardar**; Admin puede editar a cualquiera.  
  - **PATCH** ` /api/families/members/[userId]`: actualiza `name`, `phone`, `city` del User y/o `isFamilyAdmin` del FamilyMember.  
  - **GET** `/api/families/members`: devuelve miembros con `id, email, name, phone, city, isFamilyAdmin`.  
  - Botón **"Probar Twilio"** en la fila del usuario actual: siempre visible; deshabilitado si no hay teléfono con ≥10 dígitos (texto "Probar Twilio (añade teléfono)"); al tener teléfono guardado, llama a `POST /api/whatsapp/test` y envía un mensaje de prueba al WhatsApp del usuario.

- **Webhook WhatsApp**  
  - `POST /api/whatsapp/webhook`: recibe mensajes de Twilio (texto o imagen).  
  - Texto: parser tipo "500 cine Sofía" → crea transacción, código de registro E-XXXX/I-XXXX, opcional comprobante al destinatario.  
  - Imagen: descarga, OCR (OpenAI si hay key), crea transacción y recibo, subida a Spaces si está configurado.  
  - En Twilio hay que configurar la URL del webhook: `https://domus-fam.com/api/whatsapp/webhook` (método POST).

- **Código de registro (transacciones)**  
  - Campo `Transaction.registrationCode` (único por familia); generador en `domus-beta-dbe/src/lib/registration-code.ts`; usado en POST transactions, from-receipt, fake-data, seed-consumption.

- **Deploys**  
  - Se ejecutó el deploy varias veces; una vez fue necesario `npm install` local para actualizar `package-lock.json` (Twilio y deps) y luego volver a desplegar.

---

## 6. Archivos clave (domus-beta-dbe)

| Qué | Ruta |
|-----|------|
| UI única (todas las vistas) | `src/app/ui/page.tsx` |
| Estilos globales (modales, sidebar usuarios) | `src/app/globals.css` |
| Registro (API) | `src/app/api/auth/register/route.ts` |
| Miembros familia (GET/PATCH/DELETE) | `src/app/api/families/members/route.ts`, `src/app/api/families/members/[userId]/route.ts` |
| Test Twilio | `src/app/api/whatsapp/test/route.ts` |
| Webhook WhatsApp | `src/app/api/whatsapp/webhook/route.ts` |
| Lib WhatsApp (normalizePhone, findUserByPhone, sendWhatsAppMessage) | `src/lib/whatsapp.ts` |
| Código registro transacciones | `src/lib/registration-code.ts` |
| Schema DB | `prisma/schema.prisma` (User con phone, city; Transaction con registrationCode) |
| Deploy | `deploy/deploy-vps.sh` |

---

## 7. Reglas para el nuevo chat

- **Siempre responder en español.**  
- **App de producción para domus-fam.com:** es `domus-beta-dbe`, no confundir con `frontend` o `app` (otros stacks).  
- **Usuarios y edición:** la lista y edición de usuarios (teléfono, ciudad, nombre) y el botón "Probar Twilio" están en la vista **Usuarios** de `domus-fam.com/ui` (menú lateral → Usuarios).  
- **Twilio:** si el usuario no puede recibir mensajes, recordar: 1) unirse al Sandbox con `join <sandbox name>` desde WhatsApp; 2) revisar en VPS `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`.  
- **Deploy:** usar el comando de la sección 2; no subir `.env` al servidor por rsync.

---

## 8. Cómo usar este documento en el nuevo chat

Al abrir el nuevo chat, pegar o adjuntar este archivo y escribir algo como:

> "Este es el contexto del proyecto DOMUS+. Está en docs/CONTEXTO_CHAT_DOMUS_MARZO_2026.md. Necesito [tu tarea concreta]. La app en producción es domus-beta-dbe en domus-fam.com."

Así el nuevo chat tendrá todo lo necesario para no desviarse ni duplicar trabajo ya hecho.
