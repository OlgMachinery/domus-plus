#!/bin/bash

# Define base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧹 Limpiando entorno DOMUS+..."

# Kill ports
echo "🔪 Deteniendo procesos en puertos 3000 y 8000..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :8000 | xargs kill -9 2>/dev/null

# Clean cache
echo "🗑️ Eliminando caché de Next.js..."
rm -rf "$BASE_DIR/frontend/.next"

# Start Backend
echo "🚀 Iniciando Backend..."
cd "$BASE_DIR/backend"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
export DATABASE_URL="sqlite:///./domus_plus.db"
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/domus_backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Start Frontend
echo "🚀 Iniciando Frontend..."
cd "$BASE_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi
export NEXT_PUBLIC_API_URL="http://localhost:8000"
nohup npm run dev > /tmp/domus_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Sistema reiniciado correctamente!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
