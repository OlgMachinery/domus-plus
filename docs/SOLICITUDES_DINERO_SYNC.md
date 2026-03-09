# Solicitudes de dinero — revisión y sincronización

## Revisión (marzo 2026)

Se revisó el flujo de **solicitudes de dinero** y su **sincronización entre app de celular y computadora** para evitar conflictos.

### Backend (domus-beta-dbe)

- **API única:** `GET/POST /api/money-requests`, `GET/PATCH /api/money-requests/[id]`, `POST /api/money-requests/[id]/deliver`.
- **Auth:** Acepta cookie `domus_token` (web) y header `Authorization: Bearer <token>` (móvil). Misma familia que el token.
- **Familia activa:** Al cambiar de familia en la web (`/api/auth/switch-family`) se emite un nuevo token con el nuevo `familyId`; la lista de solicitudes siempre corresponde a la familia del token. Sin conflicto.

### Web (domus-fam.com / domus-beta-dbe)

- Lista se carga al entrar a la vista "Solicitudes" y tras crear/aprobar/rechazar/entregar.
- **Problema detectado:** En otro dispositivo o pestaña la lista no se actualizaba hasta cambiar de vista o recargar.
- **Cambio:** Se añadió **polling cada 30 segundos** mientras se está en la vista Solicitudes, para que cel y computadora vean los mismos datos sin recargar a mano.

### App móvil (mobile/)

- **Problema detectado:** No existía pantalla ni llamadas a la API de solicitudes; no había sincronización con la web.
- **Cambios:**
  - Tipos `MoneyRequestItem` y `MoneyRequestsResponse` en `mobile/src/api/types.ts`.
  - `fetchMoneyRequests(token)` en `mobile/src/api/client.ts` (misma API que la web).
  - Nueva pestaña **Solicitudes** con `MoneyRequestsScreen`: listado, pull-to-refresh, detalle al tocar. Botón "Abrir en navegador" para crear/aprobar/entregar en domus-fam.com.
- Misma base de datos y misma API: **sin conflicto** entre móvil y web; los datos son los mismos.

### Resumen de sincronización

| Origen              | Cómo obtiene datos                         | Sincronización |
|---------------------|--------------------------------------------|----------------|
| Web (navegador)      | GET /api/money-requests (cookie) + polling 30s | ✅ Lista se actualiza sola |
| Móvil (app nativa)   | GET /api/money-requests (Bearer token) + pull-to-refresh | ✅ Misma API; al refrescar ve lo mismo que la web |

No hay dos fuentes de verdad: todo pasa por la misma API en domus-fam.com.

## Mantenimiento

- Cualquier cambio en estados o campos de solicitudes debe reflejarse en la API y en ambos clientes (web y móvil).
- Si se añaden filtros por fecha en la web, considerar los mismos query params en móvil para consistencia.
