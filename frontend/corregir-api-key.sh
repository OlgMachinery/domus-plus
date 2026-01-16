#!/bin/bash

echo "🔧 Corregir API Key de Supabase"
echo ""
echo "El problema es que estás usando una 'service_role' key en el cliente."
echo "Necesitas usar la 'anon public' key en su lugar."
echo ""

cd "$(dirname "$0")"

# Leer la URL actual
if [ -f ".env.local" ]; then
    CURRENT_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2-)
    if [ ! -z "$CURRENT_URL" ]; then
        echo "✅ URL actual: $CURRENT_URL"
        echo ""
    fi
fi

echo "📝 Para obtener la 'anon public' key:"
echo "   1. Ve a https://supabase.com/dashboard"
echo "   2. Selecciona tu proyecto"
echo "   3. Ve a Settings → API"
echo "   4. Busca la sección 'Project API keys'"
echo "   5. Copia la clave que dice 'anon public' (NO la 'service_role')"
echo ""
echo "⚠️  IMPORTANTE: La clave 'anon public' es segura para usar en el cliente."
echo "   La clave 'service_role' es SECRETA y solo para el backend."
echo ""

read -p "¿Tienes la 'anon public' key lista? (s/n): " tiene_key

if [ "$tiene_key" != "s" ] && [ "$tiene_key" != "S" ]; then
    echo ""
    echo "❌ Por favor, obtén la key primero y vuelve a ejecutar este script."
    exit 0
fi

echo ""
read -p "Pega aquí la 'anon public' key: " ANON_KEY

if [ -z "$ANON_KEY" ]; then
    echo "❌ No se ingresó ninguna key"
    exit 1
fi

# Verificar que no sea service_role
PAYLOAD=$(echo "$ANON_KEY" | cut -d'.' -f2 2>/dev/null)
if [ ! -z "$PAYLOAD" ]; then
    DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "")
    if echo "$DECODED" | grep -q '"role":"service_role"'; then
        echo ""
        echo "❌ ERROR: Esta es una service_role key, no una anon public key"
        echo "   Por favor, copia la clave 'anon public' de Supabase"
        exit 1
    fi
fi

# Crear backup
if [ -f ".env.local" ]; then
    cp .env.local .env.local.backup
    echo "✅ Backup creado: .env.local.backup"
fi

# Actualizar el archivo
if [ -f ".env.local" ]; then
    # Actualizar solo la ANON_KEY, mantener el resto
    if grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local; then
        sed -i.bak "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY|" .env.local
        rm -f .env.local.bak
    else
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY" >> .env.local
    fi
else
    # Crear archivo nuevo
    cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=${CURRENT_URL:-https://tu-proyecto.supabase.co}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI (opcional)
# OPENAI_API_KEY=

# Twilio (opcional)
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE_NUMBER=
EOF
fi

echo ""
echo "✅ Archivo .env.local actualizado"
echo ""
echo "🔄 Limpiando caché..."
rm -rf .next
echo "✅ Caché limpiado"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Reinicia el servidor: npm run dev"
echo "   2. Abre http://localhost:3000"
echo "   3. El error 'Invalid API key' debería desaparecer"
echo ""
