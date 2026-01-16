# 📋 Pasos para Completar la Migración a Supabase

## ✅ Estado Actual

La migración del código está **completada**. Ahora necesitas ejecutar estos pasos para poner en funcionamiento la aplicación.

## 🔧 Paso 1: Instalar Dependencias

Ejecuta en tu terminal:

```bash
cd frontend
npm install
```

Esto instalará las nuevas dependencias de Supabase:
- `@supabase/supabase-js`
- `@supabase/ssr`

## 🗄️ Paso 2: Configurar Supabase

### 2.1 Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Clic en "New Project"
4. Completa el formulario:
   - **Name**: domus-plus (o el nombre que prefieras)
   - **Database Password**: Guarda esta contraseña de forma segura
   - **Region**: Elige la más cercana a ti
5. Espera a que se cree el proyecto (2-3 minutos)

### 2.2 Ejecutar el Esquema SQL

1. En el dashboard de Supabase, ve a **SQL Editor** (icono de base de datos en el menú lateral)
2. Clic en **New Query**
3. Abre el archivo `supabase/schema.sql` de este proyecto
4. Copia TODO el contenido del archivo
5. Pégalo en el editor SQL de Supabase
6. Clic en **Run** (o presiona Cmd/Ctrl + Enter)
7. Verifica que aparezca el mensaje "Success. No rows returned"

### 2.3 Obtener las API Keys

1. En el dashboard de Supabase, ve a **Settings** → **API**
2. Copia los siguientes valores:
   - **Project URL** (será algo como `https://xxxxx.supabase.co`)
   - **anon public** key (la clave pública)
   - **service_role** key (la clave de servicio - ¡manténla secreta!)

## 🔐 Paso 3: Configurar Variables de Entorno

1. En el directorio `frontend/`, crea un archivo `.env.local`:

```bash
cd frontend
touch .env.local
```

2. Abre el archivo `.env.local` y agrega:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# OpenAI (opcional - para procesamiento de recibos)
OPENAI_API_KEY=tu_openai_key

# Twilio (opcional - para WhatsApp)
TWILIO_ACCOUNT_SID=tu_twilio_sid
TWILIO_AUTH_TOKEN=tu_twilio_token
TWILIO_PHONE_NUMBER=tu_numero_twilio
```

**Reemplaza los valores con los que obtuviste en el Paso 2.3**

## 🚀 Paso 4: Probar la Aplicación

1. Asegúrate de estar en el directorio `frontend/`:

```bash
cd frontend
```

2. Inicia el servidor de desarrollo:

```bash
npm run dev
```

3. Abre tu navegador en `http://localhost:3000`

4. Prueba las siguientes funcionalidades:
   - ✅ **Registro**: Ve a `/register` y crea una cuenta nueva
   - ✅ **Login**: Ve a `/login` e inicia sesión
   - ✅ **Dashboard**: Deberías poder acceder al dashboard después del login

## 🔍 Verificación

Si todo funciona correctamente, deberías poder:

1. ✅ Registrarte con un nuevo usuario
2. ✅ Iniciar sesión con ese usuario
3. ✅ Ver el dashboard sin errores
4. ✅ Ver tus datos de usuario en la página

## ⚠️ Solución de Problemas

### Error: "Faltan las variables de entorno de Supabase"

**Solución**: Verifica que:
- El archivo `.env.local` existe en `frontend/`
- Las variables empiezan con `NEXT_PUBLIC_` para las que se usan en el cliente
- Reinicias el servidor después de agregar las variables (`npm run dev`)

### Error: "Row Level Security policy violation"

**Solución**: 
- Verifica que ejecutaste el esquema SQL completo en Supabase
- Ve a **Authentication** → **Policies** en Supabase y verifica que las políticas estén activas
- Asegúrate de estar autenticado correctamente

### Error: "User not found in users table"

**Solución**:
- Esto puede pasar si el registro no crea el usuario en la tabla `users`
- Verifica que el endpoint `/api/auth/register` esté funcionando
- Revisa los logs del servidor para ver errores específicos

### Error al instalar dependencias

Si tienes problemas con permisos de npm:

```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

O si prefieres no usar sudo:

```bash
npm install --cache /tmp/.npm
```

## 📝 Notas Importantes

1. **No compartas tus keys**: El archivo `.env.local` está en `.gitignore` por seguridad. Nunca lo subas a Git.

2. **Service Role Key**: Esta clave tiene acceso completo a tu base de datos. Úsala solo en funciones del servidor, nunca en el cliente.

3. **Migración de datos**: Si tienes datos en la base de datos anterior, necesitarás crear un script de migración para transferirlos a Supabase.

4. **Backend Legacy**: El directorio `backend/` puede mantenerse temporalmente, pero ya no es necesario para la aplicación funcionando con Supabase.

## ✅ Checklist Final

- [ ] Dependencias instaladas (`npm install`)
- [ ] Proyecto creado en Supabase
- [ ] Esquema SQL ejecutado en Supabase
- [ ] Variables de entorno configuradas en `.env.local`
- [ ] Servidor de desarrollo funcionando (`npm run dev`)
- [ ] Registro de usuario funcionando
- [ ] Login funcionando
- [ ] Dashboard accesible

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu aplicación DOMUS+ estará funcionando completamente con Next.js y Supabase.

Si encuentras algún problema, revisa:
- Los logs del servidor (`npm run dev`)
- Los logs de Supabase en el dashboard
- La consola del navegador para errores del cliente
