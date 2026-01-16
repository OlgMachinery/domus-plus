#!/bin/bash

echo "🚀 Configurando DOMUS+ con Supabase"
echo "===================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "supabase/schema.sql" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo "📋 Este script te ayudará a configurar todo paso a paso"
echo ""

# Paso 1: Obtener las API keys
echo "═══════════════════════════════════════════════════════════"
echo "PASO 1: Obtener API Keys de Supabase"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Ve a tu dashboard de Supabase"
echo "2. Clic en Settings (⚙️) → API"
echo "3. Copia los siguientes valores:"
echo ""
echo -n "   Project URL (https://xxx.supabase.co): "
read -r SUPABASE_URL

echo -n "   anon public key: "
read -r SUPABASE_ANON_KEY

echo -n "   service_role key: "
read -r SUPABASE_SERVICE_ROLE_KEY

echo ""
echo "✅ Keys recibidas"
echo ""

# Paso 2: Crear .env.local
echo "═══════════════════════════════════════════════════════════"
echo "PASO 2: Creando archivo .env.local"
echo "═══════════════════════════════════════════════════════════"
echo ""

cd frontend

cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# OpenAI (opcional - para procesamiento de recibos)
# OPENAI_API_KEY=tu_openai_key

# Twilio (opcional - para WhatsApp)
# TWILIO_ACCOUNT_SID=tu_twilio_sid
# TWILIO_AUTH_TOKEN=tu_twilio_token
# TWILIO_PHONE_NUMBER=tu_numero_twilio
EOF

echo "✅ Archivo .env.local creado en frontend/.env.local"
echo ""

# Paso 3: Instrucciones para SQL
echo "═══════════════════════════════════════════════════════════"
echo "PASO 3: Ejecutar Esquema SQL en Supabase"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Ahora necesitas ejecutar el esquema SQL en Supabase:"
echo ""
echo "1. Ve a SQL Editor en tu dashboard de Supabase"
echo "2. Clic en 'New Query'"
echo "3. Abre el archivo: supabase/schema.sql"
echo "4. Copia TODO el contenido"
echo "5. Pégalo en el editor SQL"
echo "6. Clic en 'Run' (o Cmd+Enter)"
echo ""
echo "¿Ya ejecutaste el SQL? (s/n)"
read -r sql_ejecutado

if [ "$sql_ejecutado" = "s" ] || [ "$sql_ejecutado" = "S" ]; then
    echo "✅ Perfecto!"
else
    echo "⚠️  Recuerda ejecutar el SQL antes de probar la aplicación"
fi

echo ""

# Verificación final
echo "═══════════════════════════════════════════════════════════"
echo "Verificación Final"
echo "═══════════════════════════════════════════════════════════"
echo ""

./verificar-instalacion.sh

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Configuración Completada!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🚀 Para iniciar la aplicación:"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "🌐 Luego abre: http://localhost:3000"
echo ""
