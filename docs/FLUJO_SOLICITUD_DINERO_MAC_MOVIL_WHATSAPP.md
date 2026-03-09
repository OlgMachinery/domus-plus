# Flujo de solicitud de dinero: Mac (web), móvil y WhatsApp

Una sola base de datos y una sola API. Los tres canales (navegador en Mac/PC, app móvil, WhatsApp) operan sobre los mismos registros.

---

## Flujo completo (desde que se abre hasta que se cierra)

1. **Crear** → El solicitante crea la solicitud (web: botón «Nueva solicitud de efectivo» en Solicitudes; WhatsApp: mensaje de texto). Estado: **PENDING**. Se asigna código (ej. S-0001).
2. **Pendiente** → Aparece en la lista para el admin. Opcional: el admin **aprueba** en web (o por WhatsApp al registrar entrega se auto-aprueba). Estado: **APPROVED** (o sigue PENDING si se entrega directo por WhatsApp).
3. **Registrar entrega** → El admin sube el comprobante (web: en el detalle de la solicitud; WhatsApp: responde con la foto al mensaje). Se crea la transacción (egreso) con su clave de registro (ej. E-ABC12), el recibo y la solicitud pasa a **DELIVERED**.
4. **Cerrada** → Estado **DELIVERED**: la operación queda cerrada. La transacción aparece en Transacciones con su clave de registro; el solicitante puede recibir un recibo de recepción por WhatsApp.

En **Transacciones** cada movimiento muestra su **clave de registro** (letras + números, ej. E-ABC12) en la columna «Clave» y en el detalle de la transacción.

---

## 1. Crear solicitud

| Canal | Cómo se crea | Dónde |
|-------|----------------|-------|
| **Mac / PC (web)** | Usuario entra a domus-fam.com → Solicitudes → botón **«Nueva solicitud de efectivo»** (en la cabecera de la vista). Modal: motivo, monto, partida. Enviar → `POST /api/money-requests`. | `domus-beta-dbe/src/app/ui/page.tsx` |
| **Móvil (app)** | La app **no** tiene formulario de creación. Muestra listado y detalle. El botón "Abrir en navegador" abre domus-fam.com para crear (y aprobar/entregar) desde el navegador. | `mobile/src/screens/MoneyRequestsScreen.tsx` |
| **WhatsApp** | Usuario escribe al número DOMUS por WhatsApp, por ejemplo: _solicitud 500 cine_, _necesito 300 super_, _quiero 200 farmacia_. También se usa IA para frases menos estructuradas. El webhook crea la solicitud con `prisma.moneyRequest.create` y asigna partida por motivo. | `domus-beta-dbe/src/app/api/whatsapp/webhook/route.ts` (parseMoneyRequestIntent + parseMoneyRequestFromText) |

Tras crear (web o WhatsApp):

- Se genera un **código** (ej. S-0001) único por familia.
- Si hay **admin con teléfono**: se envía mensaje WhatsApp al admin: “Nueva solicitud de efectivo: *S-0001*… _Responde a ESTE mensaje con la foto del comprobante para registrar la entrega._” y se guarda `outboundMessageSid` para vincular la respuesta después.
- En WhatsApp, al solicitante se le responde: “Solicitud de efectivo creada: *S-0001*… Revisa en la app o espera la respuesta del admin.”

---

## 2. Ver listado

| Canal | Cómo se ve | Sincronización |
|-------|------------|----------------|
| **Mac / PC** | Vista "Solicitudes": tabla con código, motivo, monto, solicitante, fecha, estado. Filtro por estado. Al entrar se hace `GET /api/money-requests`; **polling cada 30 s** mientras se está en esa vista. | Misma API; lista siempre de la familia del token/cookie. |
| **Móvil** | Pestaña "Solicitudes": lista con código, motivo, monto, estado. Pull-to-refresh llama `GET /api/money-requests` (Bearer token). Al tocar una fila se muestra detalle. | Misma API; al refrescar ve lo mismo que en web. |
| **WhatsApp** | No hay “listado” por chat. El usuario puede preguntar en lenguaje natural (ej. “¿hay solicitudes pendientes?”) y la IA responde según los datos de la familia. | Misma base de datos vía API/Prisma. |

Todos leen de la misma API o de la misma DB; no hay copia local distinta.

---

## 3. Aprobar o rechazar (solo admin)

| Canal | Cómo se hace |
|-------|--------------|
| **Mac / PC** | En la vista Solicitudes, al seleccionar una solicitud **PENDING** el admin ve botones "Aprobar" y "Rechazar". `PATCH /api/money-requests/[id]` con `action: "approve"` o `"reject"`. |
| **Móvil** | La app solo **muestra** estado; no tiene botones Aprobar/Rechazar. Debe usar "Abrir en navegador" y hacerlo en domus-fam.com. |
| **WhatsApp** | No hay comando para aprobar/rechazar por chat. El admin debe entrar a la app (Mac o navegador en el cel) y aprobar ahí. Para **registrar entrega** sí puede responder con foto al mensaje de la solicitud (ver abajo). |

---

## 4. Registrar entrega (solo admin, solicitud en estado APPROVED)

Cuando la solicitud está **APROBADA**, el admin puede “registrar entrega”: se crea la transacción (egreso), el recibo (comprobante) y la solicitud pasa a **DELIVERED**.

| Canal | Cómo se hace |
|-------|--------------|
| **Mac / PC** | En el detalle de la solicitud (estado Aprobada): subir imagen del comprobante, opcional monto enviado. Botón "Registrar entrega" → `POST /api/money-requests/[id]/deliver` (FormData con `file` y opcional `amountSent`, `allocationId`). |
| **Móvil** | No hay pantalla de “registrar entrega” en la app nativa. Debe "Abrir en navegador" y hacerlo en la web. |
| **WhatsApp** | El admin **responde con la foto del comprobante** al mensaje de WhatsApp que recibió (“Nueva solicitud de efectivo: *S-0001*…”). El webhook detecta que es respuesta a ese mensaje (`outboundMessageSid`), comprueba que el usuario es admin; no hace falta aceptar en la app (si está PENDING se auto-aprueba). Descarga la imagen, la sube a Spaces, crea la transacción y el recibo, marca la solicitud DELIVERED y responde “Entrega registrada para S-0001…”. Si la solicitud sigue PENDING, responde: “Al solicitante se le envía un Recibo de recepción de efectivo por WhatsApp (ticket verde); si no tiene teléfono, solo se confirma al admin.” |

---

## 5. Diagrama resumido

```
                    CREAR SOLICITUD
    ┌──────────────────┬──────────────────┬──────────────────┐
    │  Mac/PC (web)    │  Móvil           │  WhatsApp        │
    │  Modal → POST    │  Solo listado;   │  Texto al número │
    │  /api/money-     │  crear en        │  "solicitud 500  │
    │  requests        │  navegador       │  cine" → webhook │
    └────────┬─────────┴────────┬─────────┴────────┬─────────┘
             │                   │                  │
             └───────────────────┼──────────────────┘
                                 ▼
                    Base de datos (MoneyRequest)
                    + notificación WhatsApp al admin
                                 │
                    VER LISTADO  │  APROBAR/RECHAZAR  │  REGISTRAR ENTREGA
    ┌───────────────┐            │  ┌───────────────┐ │  ┌────────────────────┐
    │ Web: GET      │            │  │ Solo Web:     │ │  │ Web: POST .../      │
    │ + polling 30s │            │  │ PATCH approve │ │  │ deliver (form)      │
    │ Móvil: GET    │            │  │ o reject      │ │  │ WhatsApp: responder │
    │ + pull refresh│            │  │ Móvil: abrir  │ │  │ con foto al mensaje │
    │ WhatsApp:     │            │  │ navegador     │ │  │ de la solicitud     │
    │ pregunta a IA │            │  │ WhatsApp: no  │ │  │ Móvil: abrir        │
    └───────────────┘            │  │ (ir a app)    │ │  │ navegador           │
                                 │  └───────────────┘ │  └────────────────────┘
```

---

## 6. Estados de la solicitud

- **PENDING**: recién creada; el admin puede Aprobar o Rechazar.
- **APPROVED**: aprobada; el admin puede Registrar entrega (subir comprobante en web o por WhatsApp).
- **REJECTED**: rechazada; no hay más acciones.
- **DELIVERED**: entrega registrada (transacción y recibo creados).

---

## 7. Resumen por canal

| Acción | Mac/PC (web) | Móvil (app) | WhatsApp |
|--------|----------------|-------------|----------|
| Crear solicitud | ✅ Modal en /ui | ❌ Solo enlace a web | ✅ Mensaje de texto (o IA) |
| Ver listado | ✅ Tabla + polling | ✅ Lista + pull refresh | ❌ Solo vía pregunta a IA |
| Aprobar / Rechazar | ✅ Botones en detalle | ❌ Abrir navegador | ❌ Ir a la app |
| Registrar entrega | ✅ Subir imagen en detalle | ❌ Abrir navegador | ✅ Responder con foto al mensaje |

Todo persiste en la misma base de datos; web y móvil usan la misma API (domus-fam.com); WhatsApp usa el mismo backend vía webhook y Prisma.
