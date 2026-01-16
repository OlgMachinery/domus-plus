# Guía de Migración a Next.js y Supabase

Este documento describe los pasos para migrar DOMUS+ de FastAPI + PostgreSQL a Next.js + Supabase.

## Estado de la Migración

✅ **Completado:**
- Configuración de Supabase en Next.js
- Esquema de base de datos SQL para Supabase
- Autenticación migrada a Supabase Auth
- Páginas de login y registro actualizadas
- Middleware de Next.js configurado

🔄 **En Progreso:**
- Actualización del frontend para usar Supabase
- Conversión de routers de FastAPI a API Routes

⏳ **Pendiente:**
- Migración de servicios (procesamiento de recibos, WhatsApp)
- Actualización de todas las páginas del frontend
- Migración de datos existentes (si aplica)

## Pasos para Completar la Migración

### 1. Configurar Supabase

1. Crear un proyecto en [Supabase](https://supabase.com)
2. Ejecutar el esquema SQL en el SQL Editor de Supabase:
   ```bash
   # El archivo está en: supabase/schema.sql
   ```
3. Configurar las variables de entorno en `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

### 2. Instalar Dependencias

```bash
cd frontend
npm install
```

### 3. Configurar Row Level Security (RLS)

Las políticas RLS ya están incluidas en el esquema SQL. Asegúrate de que estén activas en Supabase.

### 4. Migrar Datos Existentes (Opcional)

Si tienes datos en la base de datos anterior, necesitarás:

1. Exportar datos de PostgreSQL/SQLite
2. Transformar los datos al formato de Supabase (UUIDs para usuarios)
3. Importar usando el dashboard de Supabase o scripts de migración

### 5. Actualizar Variables de Entorno

Configura las siguientes variables en `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo para funciones del servidor)
- `OPENAI_API_KEY` (para procesamiento de recibos)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (para WhatsApp)

### 6. Probar la Aplicación

```bash
cd frontend
npm run dev
```

Visita `http://localhost:3000` y prueba:
- Registro de nuevos usuarios
- Login
- Acceso a páginas protegidas

## Cambios Principales

### Autenticación

**Antes (FastAPI + JWT):**
```typescript
// Login con axios
const response = await api.post('/api/users/login', { email, password })
localStorage.setItem('token', response.data.access_token)
```

**Ahora (Supabase):**
```typescript
// Login directo con Supabase
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})
```

### Base de Datos

**Antes:**
- SQLAlchemy ORM
- Sesiones de base de datos
- Queries con SQLAlchemy

**Ahora:**
- Supabase Client
- Queries directas con `.from()`
- TypeScript types generados

### API Routes

**Antes:**
- FastAPI routers en Python
- Endpoints en `/api/users/...`, `/api/budgets/...`, etc.

**Ahora:**
- Next.js API Routes en TypeScript
- Mismo patrón de URLs pero en `/app/api/...`

## Estructura de Archivos

```
frontend/
├── app/
│   ├── api/              # API Routes (reemplazan FastAPI)
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   └── register/
│   │   └── users/
│   ├── login/            # ✅ Actualizado para Supabase
│   ├── register/         # ✅ Actualizado para Supabase
│   └── ...
├── lib/
│   ├── supabase/         # ✅ Clientes de Supabase
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── middleware.ts
│   │   └── helpers.ts
│   └── api.ts            # ⚠️ Necesita actualización
└── middleware.ts         # ✅ Configurado

supabase/
└── schema.sql            # ✅ Esquema completo de BD
```

## Próximos Pasos

1. **Actualizar `lib/api.ts`** para usar Supabase en lugar de axios
2. **Migrar routers de FastAPI** a API Routes de Next.js:
   - `/api/families/`
   - `/api/budgets/`
   - `/api/transactions/`
   - `/api/receipts/`
   - `/api/whatsapp/`
3. **Actualizar páginas del frontend** para usar Supabase:
   - Dashboard
   - Budgets
   - Transactions
   - Receipts
   - Reports
4. **Migrar servicios**:
   - Procesamiento de recibos (OpenAI)
   - Integración de WhatsApp (Twilio)
5. **Configurar Storage** en Supabase para imágenes de recibos

## Notas Importantes

- Los usuarios ahora usan UUIDs en lugar de IDs enteros
- La autenticación se maneja completamente por Supabase
- Row Level Security (RLS) protege los datos automáticamente
- No necesitas mantener un servidor backend separado
- Las funciones del servidor pueden usar `SUPABASE_SERVICE_ROLE_KEY` para bypass de RLS cuando sea necesario

## Soporte

Si encuentras problemas durante la migración:
1. Revisa los logs de Supabase en el dashboard
2. Verifica las políticas RLS
3. Asegúrate de que las variables de entorno estén configuradas correctamente
