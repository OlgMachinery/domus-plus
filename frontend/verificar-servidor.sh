#!/bin/bash

echo "🔍 Verificando servidor de Next.js..."
echo ""

# Verificar si el servidor está corriendo
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Servidor de Next.js está corriendo en http://localhost:3000"
else
    echo "❌ Servidor de Next.js NO está corriendo"
    echo ""
    echo "Para iniciarlo, ejecuta:"
    echo "  cd frontend"
    echo "  npm run dev"
    exit 1
fi

echo ""
echo "🔍 Verificando variables de entorno..."
if [ -f ".env.local" ]; then
    echo "✅ Archivo .env.local existe"
    
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
        echo "✅ NEXT_PUBLIC_SUPABASE_URL configurada"
    else
        echo "❌ NEXT_PUBLIC_SUPABASE_URL NO configurada"
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local; then
        echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada"
    else
        echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY NO configurada"
    fi
else
    echo "❌ Archivo .env.local NO existe"
    echo ""
    echo "Crea el archivo .env.local con:"
    echo "  NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co"
    echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key"
fi

echo ""
echo "✅ Verificación completada"
