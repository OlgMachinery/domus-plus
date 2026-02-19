# 🔧 Configurar Backend para Crear Usuarios en Supabase

## 📋 Requisitos

Para que el backend pueda crear usuarios en `auth.users` de Supabase, necesitas configurar las variables de entorno.

## ✅ Pasos

### 1. Instalar Dependencia de Supabase

```bash
cd backend
pip install supabase>=2.0.0
```

O agregar a `requirements.txt` (ya está agregado):
```
supabase>=2.0.0
```

### 2. Configurar Variables de Entorno

Crea o actualiza el archivo `backend/.env` con:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

**⚠️ IMPORTANTE:**
- `SUPABASE_URL`: Tu URL de Supabase (ej: `https://lpmslitbvlihzucorenj.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: La clave "service_role" de Supabase
  - **NUNCA** expongas esta clave en el frontend
  - Solo debe estar en el backend
  - Obténla en: Supabase Dashboard → Settings → API → service_role key

### 3. Verificar Configuración del Frontend

Asegúrate de que el frontend tenga la variable de entorno del backend:

En `frontend/.env.local`:
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

O si el backend está en otro puerto/host, ajusta según corresponda.

### 4. Reiniciar el Backend

Después de configurar las variables de entorno:

```bash
cd backend
# Detener el servidor si está corriendo (Ctrl+C)
# Reiniciar
uvicorn app.main:app --reload
```

## 🔍 Verificar que Funciona

1. **Inicia sesión como administrador** en el frontend
2. **Ve a `/users`**
3. **Clic en "Crear Usuario"**
4. **Completa el formulario:**
   - Nombre
   - Email (no se valida)
   - Teléfono
   - Contraseña
5. **Clic en "Crear Usuario"**

**Resultado esperado:**
- ✅ El usuario se crea en `auth.users` (Supabase)
- ✅ El usuario se crea en `public.users` (nuestra tabla)
- ✅ El usuario puede iniciar sesión inmediatamente
- ✅ El usuario aparece en la lista de usuarios

## 🐛 Solución de Problemas

### Error: "Faltan variables de entorno de Supabase"

**Solución:** Verifica que `backend/.env` tenga:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Error: "No se pudo crear el usuario en Supabase Auth"

**Posibles causas:**
1. La `SUPABASE_SERVICE_ROLE_KEY` es incorrecta
2. El backend no puede conectarse a Supabase
3. El email ya existe en Supabase

**Solución:**
- Verifica la key en Supabase Dashboard
- Verifica la conexión a internet
- Verifica que el email no exista

### Error: "Error al crear usuario en la base de datos"

**Posibles causas:**
1. Políticas RLS bloqueando la inserción
2. El usuario se creó en `auth.users` pero falló en `public.users`

**Solución:**
- Ejecuta el SQL de `supabase/rls-admin-crear-usuarios.sql`
- Verifica que las políticas RLS estén correctas

## 📝 Notas Técnicas

- El backend usa `supabase_admin` (con service_role key) para crear usuarios
- El frontend llama al backend, no directamente a Supabase
- El backend crea el usuario en ambos lugares: `auth.users` y `public.users`
- El email se confirma automáticamente (`email_confirm: true`)

## ✅ Estado

- ✅ Cliente de Supabase creado en backend
- ✅ Endpoint `/api/users/create` implementado
- ✅ Frontend actualizado para llamar al backend
- ⏳ Falta: Configurar variables de entorno en backend

**¡Configura las variables de entorno y reinicia el backend!** 🚀
