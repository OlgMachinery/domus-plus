# 🔧 Configurar Supabase - Guía Rápida

## ✅ Paso 1: Crear Proyecto en Supabase

Si ya creaste la cuenta, ahora necesitas:

1. **Crear un nuevo proyecto:**
   - En el dashboard de Supabase, clic en "New Project"
   - **Name**: `domus-plus` (o el nombre que prefieras)
   - **Database Password**: Elige una contraseña segura y **guárdala** (la necesitarás)
   - **Region**: Elige la más cercana a ti
   - Clic en "Create new project"
   - Espera 2-3 minutos a que se configure

## 🔑 Paso 2: Obtener las API Keys

Una vez que el proyecto esté listo:

1. Ve a **Settings** (icono de engranaje) → **API**
2. Encontrarás estas secciones:

### Project URL
Copia la URL que aparece en "Project URL"
Ejemplo: `https://xxxxxxxxxxxxx.supabase.co`

### API Keys
- **anon public**: Esta es la clave pública (segura para el cliente)
- **service_role**: Esta es la clave de servicio (¡MANTÉNLA SECRETA!)

## 📝 Paso 3: Crear el Archivo .env.local

Ejecuta estos comandos (reemplaza con tus valores reales):

```bash
cd frontend
cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=TU_PROJECT_URL_AQUI
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUI
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY_AQUI

# OpenAI (opcional - para procesamiento de recibos)
# OPENAI_API_KEY=tu_openai_key

# Twilio (opcional - para WhatsApp)
# TWILIO_ACCOUNT_SID=tu_twilio_sid
# TWILIO_AUTH_TOKEN=tu_twilio_token
# TWILIO_PHONE_NUMBER=tu_numero_twilio
EOF
```

**O edita manualmente:**
```bash
cd frontend
nano .env.local
```

Y pega:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

## 🗄️ Paso 4: Ejecutar el Esquema SQL

1. En el dashboard de Supabase, ve a **SQL Editor** (icono de base de datos en el menú lateral)
2. Clic en **New Query**
3. Abre el archivo `supabase/schema.sql` de este proyecto
4. Copia **TODO** el contenido del archivo
5. Pégalo en el editor SQL de Supabase
6. Clic en **Run** (o presiona Cmd/Ctrl + Enter)
7. Deberías ver: "Success. No rows returned"

## ✅ Paso 5: Verificar

```bash
cd frontend
./verificar-instalacion.sh
```

Deberías ver que ahora `.env.local` existe y está configurado.

## 🚀 Paso 6: Probar la Aplicación

```bash
cd frontend
npm run dev
```

Abre http://localhost:3000 y prueba:
- Registro en `/register`
- Login en `/login`

## ⚠️ Importante

- **NO compartas** tu `SUPABASE_SERVICE_ROLE_KEY` públicamente
- El archivo `.env.local` está en `.gitignore` por seguridad
- Guarda tu Database Password en un lugar seguro
