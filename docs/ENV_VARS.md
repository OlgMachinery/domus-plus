# Variables de entorno — domus-beta-dbe (domus-fam.com)

Referencia de variables usadas en el proyecto. En producción (VPS) se configuran en el `.env` del directorio de la app (no se sube con el deploy).

---

## Obligatorias en producción

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión a la base de datos (SQLite en archivo o servidor). | `file:./prisma/dev.db` (dev) o path en VPS |
| `JWT_SECRET` | Secreto para firmar tokens de sesión. Debe ser largo y aleatorio. | Cadena de 32+ caracteres |
| `DOMUS_APP_URL` | URL base de la app (enlaces en WhatsApp, emails, invitaciones). | `https://domus-fam.com` |

---

## WhatsApp / Twilio

| Variable | Descripción | Obligatoria si… |
|----------|-------------|------------------|
| `TWILIO_ACCOUNT_SID` | SID de cuenta Twilio | Usas WhatsApp / notificaciones por Twilio |
| `TWILIO_AUTH_TOKEN` | Token de autenticación Twilio | Idem |
| `TWILIO_WHATSAPP_NUMBER` | Número de WhatsApp (ej. 14155238886) | Idem |

---

## DigitalOcean Spaces (comprobantes / imágenes)

| Variable | Descripción | Obligatoria si… |
|----------|-------------|------------------|
| `DO_SPACES_KEY` | Access Key de Spaces | Subes comprobantes o avatares |
| `DO_SPACES_SECRET` | Secret Key de Spaces | Idem |
| `DO_SPACES_BUCKET` | Nombre del bucket | Idem |
| `DO_SPACES_ENDPOINT` | Endpoint (ej. nyc3.digitaloceanspaces.com) | Idem |
| `DO_SPACES_REGION` | Región (ej. nyc3) | Idem |

---

## OpenAI (extracción de tickets / IA)

| Variable | Descripción | Obligatoria si… |
|----------|-------------|------------------|
| `OPENAI_API_KEY` | API Key de OpenAI | Usas extracción de texto en recibos o sugerencias de categoría |
| `OPENAI_RECEIPT_MODEL` | Modelo para recibos (opcional) | Quieres otro modelo; por defecto gpt-4o-mini |
| `OPENAI_AGENT_MODEL` | Modelo para el agente (opcional) | Idem |

---

## Cron / tareas programadas

| Variable | Descripción | Obligatoria si… |
|----------|-------------|------------------|
| `CRON_SECRET` | Secreto para autorizar llamadas a rutas `/api/cron/*` | Usas crons (recordatorios, alertas, etc.) |

---

## Opcionales

| Variable | Descripción |
|----------|-------------|
| `NEXTAUTH_URL` | URL de la app; se usa como fallback de `DOMUS_APP_URL` si no está definida. |
| `NODE_ENV` | `development` o `production`. Afecta logs de Prisma y comportamiento de la app. |

---

## Dónde configurarlas

- **Desarrollo:** archivo `.env` en la raíz de `domus-beta-dbe/` (no se sube a Git).
- **Producción (domus-fam.com):** archivo `.env` en la VPS, en el mismo directorio que el proyecto que sirve el servicio (el script de deploy no sobrescribe este archivo). Ver `docs/MANTENIMIENTO_SISTEMA.md` y `domus-beta-dbe/docs/DONDE_ESTA_ENV.md` si existe.
