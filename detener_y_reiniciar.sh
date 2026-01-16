#!/bin/bash

# Script para detener el proceso en el puerto 8000 y reiniciar el servidor

echo "🔍 Buscando proceso en el puerto 8000..."

PID=$(lsof -ti :8000)

if [ -z "$PID" ]; then
    echo "✅ No hay proceso usando el puerto 8000"
else
    echo "🛑 Deteniendo proceso $PID..."
    kill -9 $PID
    echo "✅ Proceso detenido"
fi

echo ""
echo "🚀 Iniciando servidor..."
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
uvicorn app.main:app --reload

