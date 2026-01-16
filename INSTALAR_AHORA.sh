#!/bin/bash

echo "🚀 Instalando dependencias de DOMUS+ con Supabase..."
echo ""

cd frontend

# Verificar si node_modules existe
if [ -d "node_modules" ]; then
    echo "⚠️  node_modules ya existe. ¿Deseas reinstalar? (s/n)"
    read -r respuesta
    if [ "$respuesta" = "s" ] || [ "$respuesta" = "S" ]; then
        echo "🗑️  Eliminando node_modules..."
        rm -rf node_modules package-lock.json
    fi
fi

# Intentar arreglar permisos de npm
echo "🔧 Verificando permisos de npm..."
if [ -d ~/.npm ]; then
    echo "   Intentando arreglar permisos..."
    sudo chown -R $(whoami) ~/.npm 2>/dev/null || echo "   ⚠️  No se pudieron arreglar permisos (puede requerir sudo)"
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
echo ""

if npm install; then
    echo ""
    echo "✅ ¡Dependencias instaladas exitosamente!"
    echo ""
    echo "📋 Próximos pasos:"
    echo "   1. Configura Supabase (ver PASOS_MIGRACION.md)"
    echo "   2. Crea .env.local con tus keys"
    echo "   3. Ejecuta: npm run dev"
else
    echo ""
    echo "❌ Error al instalar dependencias"
    echo ""
    echo "💡 Intenta:"
    echo "   sudo chown -R \$(whoami) ~/.npm"
    echo "   npm install"
    echo ""
    echo "   O usa caché temporal:"
    echo "   npm install --cache /tmp/.npm"
fi
