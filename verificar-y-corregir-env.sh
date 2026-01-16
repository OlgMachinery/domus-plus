#!/bin/bash

echo "🔍 Verificando configuración de .env.local..."
echo ""

cd "$(dirname "$0")/frontend"

# Verificar si existe el archivo
if [ ! -f ".env.local" ]; then
    echo "❌ El archivo .env.local NO existe"
    echo ""
    echo "📝 Creando archivo .env.local..."
    echo ""
    echo "Por favor, ingresa tus credenciales de Supabase:"
    echo ""
    read -p "NEXT_PUBLIC_SUPABASE_URL (https://xxx.supabase.co): " SUPABASE_URL
    read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY (la clave 'anon public'): " SUPABASE_ANON_KEY
    read -p "SUPABASE_SERVICE_ROLE_KEY (opcional, para backend): " SUPABASE_SERVICE_ROLE_KEY
    
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
    
    echo ""
    echo "✅ Archivo .env.local creado!"
    exit 0
fi

# Verificar variables
echo "📋 Verificando variables de entorno..."
echo ""

MISSING_VARS=0

if ! grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local || grep -q "NEXT_PUBLIC_SUPABASE_URL=$" .env.local || grep -q "NEXT_PUBLIC_SUPABASE_URL=tu-proyecto" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL no está configurada correctamente"
    MISSING_VARS=1
else
    echo "✅ NEXT_PUBLIC_SUPABASE_URL configurada"
fi

if ! grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local || grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=$" .env.local || grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada correctamente"
    MISSING_VARS=1
else
    echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada"
    
    # Verificar si está usando service_role key (incorrecto)
    if grep -q "service_role" .env.local && grep "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local | grep -q "service_role"; then
        echo "⚠️  ADVERTENCIA: Parece que estás usando una service_role key en ANON_KEY"
        echo "   Esto es INCORRECTO. Necesitas usar la clave 'anon public'"
        MISSING_VARS=1
    fi
fi

echo ""

if [ $MISSING_VARS -eq 1 ]; then
    echo "❌ Hay problemas con la configuración"
    echo ""
    echo "📝 Para corregir:"
    echo "   1. Ve a tu dashboard de Supabase: https://supabase.com/dashboard"
    echo "   2. Settings → API"
    echo "   3. Copia la 'anon public' key (NO la service_role)"
    echo "   4. Edita .env.local y actualiza los valores"
    echo ""
    echo "   O ejecuta: ./crear-env-local.sh"
    exit 1
else
    echo "✅ Todas las variables están configuradas correctamente"
    echo ""
    echo "🔄 Limpiando caché y reiniciando servidor..."
    rm -rf .next
    echo "✅ Caché limpiado"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Reinicia el servidor: npm run dev"
    echo "   2. Abre http://localhost:3000"
    echo "   3. El error 'Invalid API key' debería desaparecer"
fi
