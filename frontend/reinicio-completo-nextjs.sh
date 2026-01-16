#!/bin/bash

echo "🔄 Reinicio COMPLETO de Next.js"
echo ""

cd "$(dirname "$0")"

# Detener todos los procesos en puerto 3000
echo "🛑 Deteniendo servidor..."
PIDS=$(lsof -ti :3000 2>/dev/null)
if [ ! -z "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null
    echo "✅ Servidores detenidos"
    sleep 2
else
    echo "✅ No hay servidores corriendo"
fi

# Limpiar TODO el caché
echo ""
echo "🧹 Limpiando caché completo..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
echo "✅ Caché limpiado"

# Verificar estructura de archivos
echo ""
echo "🔍 Verificando estructura..."
if [ -f "app/dashboard/page.tsx" ]; then
    echo "✅ /dashboard existe"
else
    echo "❌ /dashboard NO existe"
    exit 1
fi

if [ -f "app/error.tsx" ]; then
    echo "✅ error.tsx existe"
else
    echo "❌ error.tsx NO existe"
fi

if [ -f "app/global-error.tsx" ]; then
    echo "✅ global-error.tsx existe"
else
    echo "❌ global-error.tsx NO existe"
fi

if [ -f "app/not-found.tsx" ]; then
    echo "✅ not-found.tsx existe"
else
    echo "❌ not-found.tsx NO existe"
fi

# Verificar variables de entorno
echo ""
echo "🔍 Verificando configuración..."
if [ -f ".env.local" ]; then
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && ! grep -q "NEXT_PUBLIC_SUPABASE_URL=$" .env.local; then
        echo "✅ NEXT_PUBLIC_SUPABASE_URL configurada"
    else
        echo "⚠️  NEXT_PUBLIC_SUPABASE_URL no configurada"
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local && ! grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=$" .env.local; then
        echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada"
    else
        echo "⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada"
    fi
else
    echo "⚠️  .env.local no existe"
fi

# Verificar dependencias
echo ""
echo "📦 Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules no existe, instalando..."
    npm install
else
    echo "✅ node_modules existe"
fi

# Iniciar servidor
echo ""
echo "🚀 Iniciando servidor Next.js..."
echo "   URL: http://localhost:3000"
echo ""
echo "💡 IMPORTANTE:"
echo "   - Espera a ver 'Ready' en la terminal"
echo "   - No uses la aplicación hasta que compile completamente"
echo "   - Si ves errores de compilación, compártelos"
echo ""

npm run dev
