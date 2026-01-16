#!/bin/bash

echo "🔧 Configurando .env.local para Supabase"
echo ""

cd frontend

# Verificar si .env.local ya existe
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local ya existe."
    echo "¿Deseas sobrescribirlo? (s/n)"
    read -r respuesta
    if [ "$respuesta" != "s" ] && [ "$respuesta" != "S" ]; then
        echo "❌ Cancelado"
        exit 0
    fi
fi

echo ""
echo "📝 Ingresa los valores de Supabase:"
echo ""

# Solicitar valores
echo -n "NEXT_PUBLIC_SUPABASE_URL (https://xxx.supabase.co): "
read -r SUPABASE_URL

echo -n "NEXT_PUBLIC_SUPABASE_ANON_KEY: "
read -r SUPABASE_ANON_KEY

echo -n "SUPABASE_SERVICE_ROLE_KEY: "
read -r SUPABASE_SERVICE_ROLE_KEY

# Crear archivo
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
echo "✅ Archivo .env.local creado exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Ejecuta el esquema SQL en Supabase (ver CONFIGURAR_SUPABASE.md)"
echo "   2. Verifica: ./verificar-instalacion.sh"
echo "   3. Inicia: npm run dev"
