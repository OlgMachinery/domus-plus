#!/bin/bash

echo "🔄 Deteniendo procesos en el puerto 8000..."
PIDS=$(lsof -ti:8000 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "   Encontrados procesos: $PIDS"
    kill -9 $PIDS 2>/dev/null
    sleep 2
    echo "   ✅ Procesos detenidos"
fi

echo ""
echo "🚀 Iniciando backend..."
cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

echo "🔧 Activando entorno virtual..."
source venv/bin/activate

export DATABASE_URL="sqlite:///./domus_plus.db"

echo ""
echo "✅ Iniciando servidor en http://localhost:8000"
echo "📚 Documentación: http://localhost:8000/docs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Presiona Ctrl+C para detener el servidor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
