#!/bin/bash

echo "🔍 Verificando configuración de .env.local..."
echo ""

cd "$(dirname "$0")"

# Verificar si existe el archivo
if [ ! -f ".env.local" ]; then
    echo "❌ El archivo .env.local NO existe"
    echo ""
    echo "📝 Para crearlo, ejecuta:"
    echo "   cd frontend"
    echo "   nano .env.local"
    echo ""
    echo "Y agrega:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_public_key_aqui"
    exit 1
fi

echo "✅ .env.local existe"
echo ""

# Verificar variables
MISSING=0

if ! grep -q "^NEXT_PUBLIC_SUPABASE_URL=" .env.local || grep -q "^NEXT_PUBLIC_SUPABASE_URL=$" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL no está configurada"
    MISSING=1
else
    SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local | cut -d'=' -f2-)
    echo "✅ NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL:0:30}..."
fi

if ! grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local || grep -q "^NEXT_PUBLIC_SUPABASE_ANON_KEY=$" .env.local; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada"
    MISSING=1
else
    ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local | cut -d'=' -f2-)
    
    # Verificar si es una service_role key (decodificar JWT)
    if [ ! -z "$ANON_KEY" ]; then
        # Extraer el payload del JWT (segunda parte)
        PAYLOAD=$(echo "$ANON_KEY" | cut -d'.' -f2)
        if [ ! -z "$PAYLOAD" ]; then
            # Decodificar base64 (agregar padding si es necesario)
            DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "")
            if echo "$DECODED" | grep -q '"role":"service_role"'; then
                echo "❌ ERROR: Estás usando una service_role key (INCORRECTO)"
                echo "   Necesitas usar la clave 'anon public' de Supabase"
                MISSING=1
            elif echo "$DECODED" | grep -q '"role":"anon"'; then
                echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: anon public key (correcto)"
            else
                echo "⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY configurada (no se pudo verificar el tipo)"
            fi
        fi
    fi
fi

echo ""

if [ $MISSING -eq 1 ]; then
    echo "❌ Hay problemas con la configuración"
    echo ""
    echo "📝 Para corregir:"
    echo "   1. Ve a https://supabase.com/dashboard"
    echo "   2. Selecciona tu proyecto"
    echo "   3. Settings → API"
    echo "   4. Copia la 'anon public' key (NO la service_role)"
    echo "   5. Edita .env.local: nano .env.local"
    echo "   6. Actualiza NEXT_PUBLIC_SUPABASE_ANON_KEY con la anon public key"
    exit 1
else
    echo "✅ Configuración correcta"
    echo ""
    echo "🔄 Limpiando caché..."
    rm -rf .next
    echo "✅ Caché limpiado"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Reinicia el servidor: npm run dev"
    echo "   2. Abre http://localhost:3000"
    echo "   3. El error 'Invalid API key' debería desaparecer"
fi
