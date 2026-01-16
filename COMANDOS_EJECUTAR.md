# 🚀 Comandos para Ejecutar Manualmente

## ✅ Verificación Completada

El script de verificación muestra que:
- ✅ Todas las dependencias están en `package.json`
- ✅ Todos los archivos de Supabase están creados
- ✅ Todas las API Routes están creadas
- ⚠️  Falta crear `.env.local` con las variables de Supabase

## 📋 Comandos que DEBES Ejecutar Tú

### 1. Instalar Dependencias

**Opción A: Si tienes problemas de permisos con npm:**
```bash
cd frontend
sudo chown -R $(whoami) ~/.npm
npm install
```

**Opción B: Usar caché temporal:**
```bash
cd frontend
npm install --cache /tmp/.npm
```

**Opción C: Limpiar caché y reinstalar:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### 2. Crear Archivo de Variables de Entorno

```bash
cd frontend
cat > .env.local << 'EOF'
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
EOF
```

**IMPORTANTE**: Reemplaza los valores con tus keys reales de Supabase.

### 3. Configurar Supabase

1. **Crear proyecto en Supabase:**
   - Ve a https://supabase.com
   - Crea un nuevo proyecto
   - Espera 2-3 minutos a que se configure

2. **Ejecutar el esquema SQL:**
   - En el dashboard de Supabase, ve a **SQL Editor**
   - Clic en **New Query**
   - Abre el archivo `supabase/schema.sql`
   - Copia TODO el contenido
   - Pégalo en el editor y ejecuta (Cmd/Ctrl + Enter)

3. **Obtener las API Keys:**
   - Ve a **Settings** → **API**
   - Copia:
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Probar la Aplicación

```bash
cd frontend
npm run dev
```

Luego abre: http://localhost:3000

## 🔍 Verificar que Todo Funciona

```bash
cd frontend
./verificar-instalacion.sh
```

Deberías ver:
- ✅ Todas las dependencias instaladas
- ✅ Todos los archivos creados
- ✅ Variables de entorno configuradas

## ⚠️ Si npm install Falla

### Error de Permisos:
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### Error de Red:
```bash
npm install --registry https://registry.npmjs.org/
```

### Limpiar Todo y Reinstalar:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## 📝 Checklist

- [ ] Dependencias instaladas (`npm install`)
- [ ] Archivo `.env.local` creado con tus keys
- [ ] Proyecto creado en Supabase
- [ ] Esquema SQL ejecutado en Supabase
- [ ] Servidor funcionando (`npm run dev`)
- [ ] Puedes registrarte en `/register`
- [ ] Puedes iniciar sesión en `/login`

## 🎯 Estado Actual

✅ **Código migrado completamente**
✅ **Archivos creados**
✅ **Estructura lista**

⏳ **Pendiente de ti:**
- Instalar dependencias
- Configurar Supabase
- Agregar variables de entorno
- Probar la aplicación
