# Usuarios en DOMUS: cómo se generan y cómo se administran

Resumen del flujo de usuarios e integrantes de familia en **domus-beta-dbe** (domus-fam.com).

---

## 1. Cómo se generan los usuarios

Hay **dos formas** de que exista un usuario en el sistema:

### A) Registro público (nueva familia)

**Dónde:** Pantalla de registro (`/register` o vista de login/registro en la app).

**Flujo:**
1. La persona ingresa: **email**, **contraseña** (mín. 6 caracteres), **teléfono** (mín. 10 dígitos), **nombre** (opcional), **ciudad** (opcional), **nombre de la familia** (opcional).
2. Se llama a **`POST /api/auth/register`**.
3. El backend:
   - Crea un **User** (email, contraseña hasheada, nombre, teléfono, ciudad).
   - Crea una **Family** nueva (nombre por defecto tipo "Familia de [nombre]" si no se indica).
   - Crea un **FamilyMember** vinculando ese usuario a esa familia con **`isFamilyAdmin: true`**.
   - Opcionalmente crea partidas/categorías por defecto para esa familia.
4. Se inicia sesión automáticamente (cookie de sesión) y se redirige a setup (p. ej. `/setup/objects`).

**Código:** `domus-beta-dbe/src/app/api/auth/register/route.ts` y en la UI la función `register()` que hace `postJson('/api/auth/register', { ... })`.

**Nota:** El formulario puede enviar `belongs_to_family` y `familyName`, pero el **backend actual siempre crea una familia nueva**; no hay flujo de “unirse a una familia existente” por código de invitación en el registro.

---

### B) El administrador agrega integrantes (usuarios en la familia activa)

**Dónde:** Vista **Usuarios** de la app (menú → Usuarios), solo visible para el **Admin** el bloque “Agregar / invitar”.

**Flujo:**
1. El admin escribe: **email** (obligatorio), **nombre** (opcional), **contraseña** (obligatoria solo si el email no existe), y puede marcar **“Hacer admin”**.
2. Se llama a **`POST /api/families/members`** (requiere ser admin de la familia activa).
3. El backend:
   - Busca si ya existe un **User** con ese email.
   - **Si no existe:** crea el User (email, contraseña hasheada, nombre, teléfono) y luego crea el **FamilyMember** (familia actual, `isFamilyAdmin` según lo elegido).
   - **Si ya existe:** solo crea el **FamilyMember** (añade ese usuario a la familia actual). No se pide contraseña en ese caso.
4. El nuevo integrante puede iniciar sesión con su email y contraseña; al entrar verá la familia a la que fue agregado (o puede cambiar de familia si pertenece a varias).

**Código:** `domus-beta-dbe/src/app/api/families/members/route.ts` (POST). En la UI, función `inviteMember()` que hace `postJson('/api/families/members', { name, email, password, isFamilyAdmin })`.

---

## 2. Cómo se administran los usuarios

La administración se hace desde la vista **Usuarios** (familia activa) y con las APIs de miembros.

### Quién puede administrar

- **Solo el administrador de la familia** puede:
  - Agregar integrantes (POST members).
  - Cambiar el rol (admin / no admin) de otro integrante.
  - Editar datos de otros (nombre, teléfono, ciudad).
  - Eliminar integrantes de la familia.
- **Cualquier usuario** puede:
  - Editar **sus propios** datos (nombre, teléfono, ciudad) y subir su avatar.

### Acciones disponibles (API y UI)

| Acción | API | Quién |
|--------|-----|--------|
| Agregar usuario a la familia | `POST /api/families/members` | Solo Admin |
| Editar nombre, teléfono, ciudad de un usuario | `PATCH /api/families/members/[userId]` | Admin (cualquier usuario) o el propio usuario (solo él) |
| Cambiar rol (hacer admin / quitar admin) | `PATCH /api/families/members/[userId]` con `isFamilyAdmin` | Solo Admin |
| Quitar a un usuario de la familia | `DELETE /api/families/members/[userId]` | Solo Admin |

**Reglas de negocio:**
- Tiene que haber **al menos un admin** en la familia. No se puede quitar el rol de admin al último administrador ni eliminar al último admin.
- El admin no puede eliminarse a sí mismo si es el único admin.

**Código:** `domus-beta-dbe/src/app/api/families/members/[userId]/route.ts` (PATCH y DELETE). En la UI, vista `view === 'usuarios'` con tabla de miembros, formulario “Agregar usuario”, botones Guardar por fila y eliminar.

### Datos que se gestionan

- **User:** email, contraseña (solo en creación), nombre, teléfono, ciudad, avatar (vía endpoint de avatar).
- **FamilyMember:** pertenencia a la familia y `isFamilyAdmin`.

La lista de integrantes que ve la familia activa se obtiene con la API que devuelve la familia activa y sus miembros (p. ej. desde `/api/families/active` o el flujo que rellena `members` en la UI).

---

## 3. Resumen visual

```
Registro público (POST /api/auth/register)
    → Crea User + Family nueva + FamilyMember (admin)
    → Una persona = una familia nueva

Admin en Usuarios (POST /api/families/members)
    → Si el email no existe: crea User + FamilyMember
    → Si el email ya existe: solo crea FamilyMember (añade a la familia)
    → Un mismo User puede estar en varias familias (cambiando “familia activa”)

Administración (PATCH/DELETE /api/families/members/[userId])
    → Editar perfil (nombre, teléfono, ciudad) y rol (admin)
    → Quitar de la familia (DELETE)
    → Solo Admin para otros; cada uno puede editar su propio perfil
```

---

## 4. Referencia de archivos

| Qué | Archivo |
|-----|---------|
| Registro (crear cuenta + familia) | `src/app/api/auth/register/route.ts` |
| Login | `src/app/api/auth/login/route.ts` |
| Sesión / familia activa | `src/app/api/auth/me/route.ts`, `src/lib/auth/session.ts` |
| Agregar integrante | `src/app/api/families/members/route.ts` (POST) |
| Editar / eliminar integrante | `src/app/api/families/members/[userId]/route.ts` (PATCH, DELETE) |
| UI registro | `src/app/ui/page.tsx` (función `register()`, formulario de registro) |
| UI Usuarios (lista, agregar, editar) | `src/app/ui/page.tsx` (vista `usuarios`, `inviteMember()`, `saveUserProfile()`, etc.) |

Si más adelante quieres que un usuario **se una a una familia existente** sin que un admin lo agregue antes (p. ej. con un código de invitación), habría que añadir ese flujo en el registro o en un endpoint específico de “unirse a familia” y usarlo desde la UI.
