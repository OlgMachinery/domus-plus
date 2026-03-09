# Qué ve cada usuario en DOMUS+

Resumen de lo que ve y puede hacer **cada usuario** según su rol y familia activa (app en **domus-fam.com/ui**).

---

## 1. Alcance común (todos los usuarios)

- **Familia activa:** Cada usuario tiene una **familia activa** (selector arriba: "Familia: …"). Solo ve datos de esa familia.
- **Menú:** Todos ven el mismo menú: Dashboard, Presupuesto, Transacciones, Usuarios, Reportes, Configuración, Partidas, Arquitectura. (En el futuro se podrá añadir **Solicitudes** para solicitar dinero desde DOMUS; ver `docs/PROPUESTA_SOLICITUD_DINERO_DOMUS.md`.)
- **Rol visible:** En la barra superior aparece **"Admin"** (verde) o **"Usuario"** (naranja) según si es administrador de la familia activa o no.

---

## 2. Por vista (qué ve cada uno)

### Dashboard
- **Todos:** Resumen del presupuesto (total, gastado, disponible, alertas), KPIs "Por confirmar" (recibos pendientes de asignar/confirmar), "Pendientes de categoría/usuario", gráfica de gasto mensual, distribución por categorías, tabla de transacciones recientes.
- **Admin:** Igual; además puede disparar la carga de datos de ejemplo (si aplica).

### Presupuesto
- **Todos:** Ven partidas (objetos), categorías, asignaciones (montos), tablas y estado del presupuesto.
- **Admin:** Puede **crear y editar** partidas, categorías, montos, activar/desactivar, duplicar asignaciones, subir imágenes de cualquier partida, asignar “dueños” (responsables) a partidas.
- **Usuario (no admin):** Ve todo en **solo lectura** (no puede crear ni editar partidas/categorías/montos). Puede **subir o cambiar la foto de perfil** solo de la partida de la que es **responsable** (si el admin le asignó como dueño de esa partida).

### Transacciones
- **Todos:** Lista de transacciones de la familia (filtros por fecha, categoría, partida, usuario, comprobante), detalle de cada gasto, pestaña Evidencias (recibos/tickets).
- **Todos:** Pueden **subir comprobantes** (fotos de tickets). Por defecto el gasto va a **su propia cuenta** (su partida en el presupuesto). Si el gasto es **para otro miembro** (ej. medicina para otro familiar), en el wizard “Nuevo gasto con comprobante” pueden elegir **Otros usuarios** y asignar el gasto a esa persona.
- **Todos:** Pueden **confirmar** recibos ya extraídos (asignar y confirmar) si tienen acceso al detalle de la transacción.
- **Usuario (no admin):** En la tabla de Usuarios solo puede **editar su propia fila** (nombre, teléfono, ciudad).

### Usuarios
- **Todos:** Ven la página "Usuarios (familia activa)": formulario "Agregar / invitar" y tabla con nombre, email, teléfono, ciudad, Admin, acciones.
- **Admin:** Puede **agregar usuarios**, marcar "Hacer admin", **Guardar** cambios de otros, **Eliminar** a otros (o **Salir** si es él mismo), **Probar Twilio** en su fila.
- **Usuario (no admin):** Ve la misma pantalla; en la tabla solo puede **editar su propia fila** (nombre, teléfono, ciudad) y **Guardar**; no puede agregar usuarios ni eliminar a otros (el texto indica "Solo Admin").

### Reportes
- **Todos:** Ven las pestañas Detalle, Resumen, Tablas, Consumo; filtros por cuenta, categoría, persona, rango, recibos; historial de transacciones y métricas según filtros.
- **Admin:** Puede cambiar el “scope” de reportes (a qué partida/persona se aplican ciertos permisos o vistas), según la lógica del modal de reportes.
- **Usuario:** Ve los mismos reportes y filtros; las acciones reservadas a admin (por ejemplo asignar “quién es admin” en reportes) están deshabilitadas.

### Configuración
- **Todos:** Ven la sección "Editar familia" y el texto sobre cambiar familia activa o cerrar sesión desde el menú superior.
- **Admin:** Puede **editar nombre de la familia** y otras opciones de la familia, y **eliminar la familia** (con confirmación).
- **Usuario (no admin):** No puede editar familia ni eliminarla; al intentar eliminar: "Solo el administrador puede eliminar la familia".

### Partidas / Arquitectura
- **Partidas:** Redirige a `/setup/objects` (configuración de partidas/objetos).
- **Arquitectura:** Redirige a `/ui/system-architecture` (diagrama del sistema).
- **Todos** pueden abrir estas pantallas; la edición real suele depender de permisos en cada API.

---

## 3. Resumen por rol

| Área            | Admin (familia) | Usuario (no admin) |
|-----------------|------------------|--------------------|
| Dashboard       | Ver todo         | Ver todo           |
| Presupuesto     | Crear/editar todo| Solo lectura       |
| Transacciones   | Ver + subir comprobantes (propios o asignar a otro) | Ver + subir comprobantes (propios o asignar a otro); editar su perfil en Usuarios |
| Usuarios        | Agregar, editar todos, eliminar, Probar Twilio | Ver lista; editar solo su nombre/teléfono/ciudad |
| Reportes        | Ver + acciones de scope/admin | Ver reportes; acciones de admin deshabilitadas |
| Configuración   | Editar familia, eliminar familia | Solo ver; no editar ni eliminar |

---

## 4. Familia y multi-familia

- Un usuario puede pertenecer a **varias familias** (selector "Familia: …" en la barra).
- En cada familia tiene un rol: **Admin** o **Usuario** (solo lectura en presupuesto, etc.).
- **Solo ve datos de la familia activa** (transacciones, usuarios, presupuesto, reportes de esa familia).

---

## 5. WhatsApp (comprobantes por mensaje)

- Cualquier usuario **registrado** con su **teléfono** en Usuarios puede enviar mensajes/fotos al número de DOMUS en WhatsApp.
- El sistema identifica al usuario por teléfono y asocia los gastos a la **familia** de ese usuario (según su membresía).
- No depende del rol Admin/Usuario en la app: si el número está en la familia, puede registrar por WhatsApp.

---

*Documento de referencia para producto y soporte. Si cambian permisos en el código, conviene actualizar este archivo.*

**Especificación ampliada (entorno de usuario, sugerencias, sub-cuentas, avatar, personalización):** `docs/ENTORNO_USUARIO_Y_PERMISOS.md`
