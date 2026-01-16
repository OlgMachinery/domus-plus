#!/bin/bash

echo "🧹 Limpiando caché y reiniciando Frontend DOMUS+..."
echo ""

cd "$(dirname "$0")/frontend"

# Detener procesos en puerto 3000
echo "🛑 Deteniendo procesos en puerto 3000..."
PID_FRONTEND=$(lsof -ti :3000 2>/dev/null)
if [ ! -z "$PID_FRONTEND" ]; then
    kill -9 $PID_FRONTEND 2>/dev/null
    echo "✅ Proceso detenido (PID: $PID_FRONTEND)"
    sleep 2
else
    echo "✅ No hay procesos corriendo en el puerto 3000"
fi

# Limpiar caché de Next.js
echo ""
echo "🧹 Limpiando caché de Next.js..."
rm -rf .next
echo "✅ Caché limpiado"

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📥 Instalando dependencias..."
    npm install
fi

# Configurar URL de API
export NEXT_PUBLIC_API_URL="http://localhost:8000"

# Iniciar servidor de desarrollo
echo ""
echo "🚀 Iniciando servidor en http://localhost:3000"
echo ""
echo "💡 Después de que el servidor inicie, presiona Cmd + Shift + R en el navegador"
echo "   para hacer un hard refresh y ver los cambios."
echo ""
npm run dev
