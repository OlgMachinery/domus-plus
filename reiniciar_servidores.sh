#!/bin/bash

echo "🔄 Reiniciando servidores DOMUS+..."
echo ""

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detener procesos en puerto 3000 (Frontend)
echo "🔍 Buscando proceso en el puerto 3000 (Frontend)..."
PID_FRONTEND=$(lsof -ti :3000 2>/dev/null)
if [ -z "$PID_FRONTEND" ]; then
    echo "✅ No hay proceso usando el puerto 3000"
else
    echo "🛑 Deteniendo proceso Frontend (PID: $PID_FRONTEND)..."
    kill -9 $PID_FRONTEND 2>/dev/null
    sleep 1
    echo "✅ Frontend detenido"
fi

# Detener procesos en puerto 8000 (Backend)
echo ""
echo "🔍 Buscando proceso en el puerto 8000 (Backend)..."
PID_BACKEND=$(lsof -ti :8000 2>/dev/null)
if [ -z "$PID_BACKEND" ]; then
    echo "✅ No hay proceso usando el puerto 8000"
else
    echo "🛑 Deteniendo proceso Backend (PID: $PID_BACKEND)..."
    kill -9 $PID_BACKEND 2>/dev/null
    sleep 1
    echo "✅ Backend detenido"
fi

echo ""
echo "⏳ Esperando 2 segundos antes de reiniciar..."
sleep 2

echo ""
echo "🚀 Iniciando Backend..."
cd "$BASE_DIR/backend"

# Verificar si existe el entorno virtual
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
source venv/bin/activate

# Configurar base de datos
export DATABASE_URL="sqlite:///./domus_plus.db"

# Iniciar backend en background
echo "✅ Backend iniciando en http://localhost:8000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/domus_backend.log 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

echo ""
echo "🚀 Iniciando Frontend..."
cd "$BASE_DIR"

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📥 Instalando dependencias..."
    npm install
fi

# Configurar URL de API
export NEXT_PUBLIC_API_URL="http://localhost:8000"

# Iniciar frontend en background
echo "✅ Frontend iniciando en http://localhost:3000"
npm run dev > /tmp/domus_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"

echo ""
echo "✅ Servidores iniciados!"
echo ""
echo "📊 Para ver los logs:"
echo "   Backend:  tail -f /tmp/domus_backend.log"
echo "   Frontend: tail -f /tmp/domus_frontend.log"
echo ""
echo "🌐 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   Docs:     http://localhost:8000/docs"
echo ""
echo "🛑 Para detener los servidores:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""
