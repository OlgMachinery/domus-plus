#!/bin/bash

echo "📦 Instalando dependencias faltantes..."
echo ""

cd "$(dirname "$0")"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    exit 1
fi

echo "📥 Instalando paquetes..."
npm install

echo ""
echo "✅ Dependencias instaladas"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Reinicia el servidor: npm run dev"
echo "   2. El error 'Module not found: openai' debería desaparecer"
