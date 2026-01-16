#!/bin/bash

echo "🔄 Reiniciando servidor de desarrollo Next.js..."
echo ""

# Detener procesos en puerto 3000
echo "🛑 Deteniendo procesos en puerto 3000..."
PID=$(lsof -ti :3000 2>/dev/null)
if [ ! -z "$PID" ]; then
    kill -9 $PID 2>/dev/null
    echo "✅ Proceso detenido (PID: $PID)"
    sleep 2
fi

# Limpiar caché
echo ""
echo "🧹 Limpiando caché de Next.js..."
rm -rf .next
echo "✅ Caché limpiado"

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📥 Instalando dependencias..."
    npm install
fi

# Configurar variables de entorno
export NEXT_PUBLIC_API_URL="http://localhost:8000"

# Iniciar servidor
echo ""
echo "🚀 Iniciando servidor de desarrollo..."
echo "   URL: http://localhost:3000"
echo ""
echo "💡 Espera a que veas 'Ready' en la terminal antes de usar la aplicación"
echo ""

npm run dev
