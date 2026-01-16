#!/bin/bash

echo "🚀 Iniciando Frontend DOMUS+..."

cd "$(dirname "$0")/frontend"

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📥 Instalando dependencias..."
    npm install
fi

# Configurar URL de API
export NEXT_PUBLIC_API_URL="http://localhost:8000"

# Iniciar servidor de desarrollo
echo "✅ Iniciando servidor en http://localhost:3000"
echo ""
npm run dev
