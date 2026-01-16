#!/bin/bash

echo "🔄 Reinicio completo del servidor Next.js"
echo ""

cd "$(dirname "$0")"

# Detener procesos en puerto 3000
echo "🛑 Deteniendo servidor..."
PID=$(lsof -ti :3000 2>/dev/null)
if [ ! -z "$PID" ]; then
    kill -9 $PID 2>/dev/null
    echo "✅ Servidor detenido (PID: $PID)"
    sleep 2
else
    echo "✅ No hay servidor corriendo"
fi

# Limpiar caché
echo ""
echo "🧹 Limpiando caché..."
rm -rf .next
echo "✅ Caché limpiado"

# Verificar que las rutas existen
echo ""
echo "🔍 Verificando rutas..."
if [ -f "app/login/page.tsx" ]; then
    echo "✅ /login existe"
else
    echo "❌ /login NO existe"
fi

if [ -f "app/page.tsx" ]; then
    echo "✅ / (home) existe"
else
    echo "❌ / (home) NO existe"
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

# Iniciar servidor
echo ""
echo "🚀 Iniciando servidor..."
echo "   URL: http://localhost:3000"
echo ""
echo "💡 Espera a que veas 'Ready' antes de usar la aplicación"
echo ""

npm run dev
