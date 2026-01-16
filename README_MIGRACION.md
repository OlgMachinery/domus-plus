# 🚀 Migración de DOMUS+ a Next.js y Supabase

## ✅ Estado Actual

La migración está **parcialmente completada**. Se ha configurado la infraestructura base:

### Completado ✅
- ✅ Configuración de Supabase en Next.js
- ✅ Esquema de base de datos SQL para Supabase
- ✅ Autenticación migrada a Supabase Auth
- ✅ Páginas de login y registro actualizadas
- ✅ Middleware de Next.js configurado
- ✅ Helpers y clientes de Supabase creados
- ✅ API Routes básicas (auth, users, families)

### En Progreso 🔄
- 🔄 Conversión de routers de FastAPI a API Routes
- 🔄 Actualización de páginas del frontend

### Pendiente ⏳
- ⏳ Migración de servicios (procesamiento de recibos, WhatsApp)
- ⏳ Actualización completa de todas las páginas
- ⏳ Migración de datos existentes

## 📋 Pasos para Completar la Migración

### 1. Configurar Supabase

1. **Crear proyecto en Supabase:**
   - Ve a [supabase.com](https://supabase.com)
   - Crea un nuevo proyecto
   - Anota la URL y las API keys

2. **Ejecutar el esquema SQL:**
   - Ve al SQL Editor en el dashboard de Supabase
   - Copia y ejecuta el contenido de `supabase/schema.sql`
   - Verifica que todas las tablas se crearon correctamente

3. **Configurar variables de entorno:**
   Crea un archivo `.env.local` en `frontend/`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   
   # Opcional: Para servicios
   OPENAI_API_KEY=tu_openai_key
   TWILIO_ACCOUNT_SID=tu_twilio_sid
   TWILIO_AUTH_TOKEN=tu_twilio_token
   TWILIO_PHONE_NUMBER=tu_numero_twilio
   ```

### 2. Instalar Dependencias

```bash
cd frontend
npm install
```

Esto instalará:
- `@supabase/supabase-js` - Cliente de Supabase
- `@supabase/ssr` - Soporte SSR para Next.js

### 3. Probar la Aplicación

```bash
cd frontend
npm run dev
```

Visita `http://localhost:3000` y prueba:
- ✅ Registro de nuevos usuarios
- ✅ Login
- ✅ Acceso a páginas protegidas

## 🔄 Cambios Principales

### Autenticación

**Antes:**
```typescript
// Login con axios al backend FastAPI
const response = await api.post('/api/users/login', { email, password })
localStorage.setItem('token', response.data.access_token)
```

**Ahora:**
```typescript
// Login directo con Supabase
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
})
// La sesión se maneja automáticamente
```

### Base de Datos

**Antes:**
- SQLAlchemy ORM en Python
- Queries con SQLAlchemy
- Sesiones de base de datos

**Ahora:**
- Supabase Client en TypeScript
- Queries directas: `supabase.from('table').select()`
- TypeScript types generados automáticamente

### API Routes

**Antes:**
- FastAPI routers en `backend/app/routers/`
- Endpoints: `/api/users/...`, `/api/budgets/...`

**Ahora:**
- Next.js API Routes en `frontend/app/api/`
- Mismo patrón de URLs pero en TypeScript

## 📁 Estructura de Archivos

```
domus-plus/
├── frontend/
│   ├── app/
│   │   ├── api/              # ✅ API Routes (reemplazan FastAPI)
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── users/
│   │   │   │   └── me/
│   │   │   └── families/
│   │   ├── login/            # ✅ Actualizado para Supabase
│   │   ├── register/         # ✅ Actualizado para Supabase
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/         # ✅ Clientes de Supabase
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── middleware.ts
│   │   │   └── helpers.ts
│   │   ├── api.ts            # ⚠️ Legacy (puede eliminarse)
│   │   └── api-supabase.ts   # ✅ Nueva implementación
│   └── middleware.ts         # ✅ Configurado
├── supabase/
│   └── schema.sql            # ✅ Esquema completo de BD
└── backend/                  # ⚠️ Legacy (puede eliminarse después)
```

## 🎯 Próximos Pasos

### Inmediatos

1. **Completar API Routes:**
   - [ ] `/api/budgets/` - Presupuestos
   - [ ] `/api/transactions/` - Transacciones
   - [ ] `/api/receipts/` - Recibos
   - [ ] `/api/whatsapp/` - WhatsApp webhook

2. **Actualizar páginas del frontend:**
   - [ ] Dashboard - Usar Supabase directamente
   - [ ] Budgets - Migrar queries
   - [ ] Transactions - Migrar queries
   - [ ] Receipts - Migrar queries y procesamiento

3. **Migrar servicios:**
   - [ ] Procesamiento de recibos (OpenAI) - Mover a API Route
   - [ ] Integración de WhatsApp (Twilio) - Mover a API Route

### A Mediano Plazo

1. **Configurar Storage en Supabase:**
   - Bucket para imágenes de recibos
   - Políticas de acceso

2. **Migrar datos existentes:**
   - Script de migración de PostgreSQL/SQLite a Supabase
   - Transformación de IDs enteros a UUIDs

3. **Optimizaciones:**
   - Generar tipos TypeScript desde Supabase
   - Implementar caché donde sea necesario
   - Optimizar queries con índices

## ⚠️ Notas Importantes

1. **UUIDs vs IDs Enteros:**
   - Los usuarios ahora usan UUIDs (de `auth.users`)
   - Las familias, presupuestos, transacciones siguen usando IDs enteros
   - Asegúrate de actualizar todas las referencias

2. **Row Level Security (RLS):**
   - Las políticas RLS están configuradas en el esquema
   - Protegen automáticamente los datos por usuario/familia
   - Usa `SUPABASE_SERVICE_ROLE_KEY` solo en funciones del servidor cuando necesites bypass

3. **Autenticación:**
   - Supabase maneja la sesión automáticamente
   - No necesitas guardar tokens en localStorage
   - El middleware actualiza la sesión automáticamente

4. **Backend Legacy:**
   - El directorio `backend/` puede mantenerse temporalmente
   - Una vez completada la migración, puede eliminarse
   - O mantenerse solo para servicios específicos que no se migren

## 🐛 Solución de Problemas

### Error: "Faltan las variables de entorno de Supabase"
- Verifica que `.env.local` existe en `frontend/`
- Asegúrate de que las variables empiecen con `NEXT_PUBLIC_` para el cliente

### Error: "Row Level Security policy violation"
- Verifica que las políticas RLS estén activas en Supabase
- Revisa que el usuario esté autenticado correctamente
- Usa el dashboard de Supabase para verificar las políticas

### Error: "User not found in users table"
- Asegúrate de que después de `signUp`, se cree el registro en la tabla `users`
- Verifica el trigger o función que sincroniza `auth.users` con `users`

## 📚 Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Next.js con Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## 🤝 Contribuir

Si encuentras problemas o quieres completar alguna parte de la migración:
1. Revisa el estado actual en este README
2. Consulta `MIGRACION_SUPABASE.md` para detalles técnicos
3. Verifica los logs de Supabase en el dashboard
