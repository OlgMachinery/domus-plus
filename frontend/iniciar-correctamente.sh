#!/bin/bash

echo "🚀 Iniciando servidor de Next.js correctamente..."
echo ""

# Ir al directorio del proyecto
cd "$(dirname "$0")"
cd "$(pwd)"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    echo "   Asegúrate de estar en el directorio frontend/"
    exit 1
fi

echo "✅ Directorio correcto: $(pwd)"
echo ""

# Verificar que node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

# Verificar variables de entorno
if [ ! -f ".env.local" ]; then
    echo "⚠️  ADVERTENCIA: No se encontró .env.local"
    echo "   El servidor puede no funcionar correctamente sin las variables de Supabase"
    echo ""
    echo "   Crea el archivo .env.local con:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key"
    echo ""
    read -p "¿Continuar de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Limpiar build anterior si existe
if [ -d ".next" ]; then
    echo "🧹 Limpiando build anterior..."
    rm -rf .next
    echo ""
fi

# Iniciar servidor
echo "🚀 Iniciando servidor de desarrollo..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Servidor iniciado en: http://localhost:3000"
echo "  📝 Presiona Ctrl+C para detener el servidor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
