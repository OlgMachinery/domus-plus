#!/bin/bash

echo "🚀 Iniciando servidor Next.js"
echo ""

cd "$(dirname "$0")"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    echo "   Asegúrate de estar en el directorio frontend/"
    exit 1
fi

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

# Verificar variables de entorno
if [ ! -f ".env.local" ]; then
    echo "⚠️  Advertencia: .env.local no existe"
    echo "   Algunas funcionalidades pueden no funcionar"
    echo ""
fi

# Detener procesos existentes en puerto 3000
echo "🛑 Verificando puerto 3000..."
PID=$(lsof -ti :3000 2>/dev/null)
if [ ! -z "$PID" ]; then
    echo "   Proceso encontrado (PID: $PID), deteniendo..."
    kill -9 $PID 2>/dev/null
    sleep 2
    echo "   ✅ Proceso detenido"
else
    echo "   ✅ Puerto 3000 disponible"
fi
echo ""

# Limpiar caché si existe
if [ -d ".next" ]; then
    echo "🧹 Limpiando caché..."
    rm -rf .next
    echo "   ✅ Caché limpiado"
    echo ""
fi

# Iniciar servidor
echo "🚀 Iniciando servidor Next.js..."
echo "   URL: http://localhost:3000"
echo ""
echo "💡 Espera a ver 'Ready' antes de usar la aplicación"
echo "   Presiona Ctrl+C para detener el servidor"
echo ""

npm run dev
