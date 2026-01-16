#!/bin/bash

echo "🔧 Solucionando problema de conexión del backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Detener todos los procesos en el puerto 8000
echo "1️⃣ Deteniendo procesos en el puerto 8000..."
PIDS=$(lsof -ti:8000 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "   Encontrados procesos: $PIDS"
    kill -9 $PIDS 2>/dev/null
    sleep 2
    echo "   ✅ Procesos detenidos"
else
    echo "   ℹ️  No hay procesos en el puerto 8000"
fi

# 2. Verificar que el puerto esté libre
echo ""
echo "2️⃣ Verificando que el puerto esté libre..."
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "   ⚠️  El puerto aún está ocupado. Intenta manualmente:"
    echo "      lsof -ti:8000 | xargs kill -9"
    exit 1
else
    echo "   ✅ Puerto 8000 está libre"
fi

# 3. Ir al directorio del backend
cd "$(dirname "$0")/backend"

# 4. Verificar entorno virtual
if [ ! -d "venv" ]; then
    echo ""
    echo "3️⃣ Creando entorno virtual..."
    python3 -m venv venv
fi

# 5. Activar entorno virtual
echo ""
echo "4️⃣ Activando entorno virtual..."
source venv/bin/activate

# 6. Instalar dependencias si es necesario
if [ ! -f "venv/.installed" ]; then
    echo ""
    echo "5️⃣ Instalando dependencias..."
    pip install --upgrade pip
    pip install -r requirements.txt
    touch venv/.installed
else
    echo ""
    echo "5️⃣ Dependencias ya instaladas"
fi

# 7. Configurar base de datos
export DATABASE_URL="sqlite:///./domus_plus.db"

# 8. Iniciar servidor
echo ""
echo "6️⃣ Iniciando servidor backend..."
echo "   📍 URL: http://localhost:8000"
echo "   📚 Docs: http://localhost:8000/docs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend iniciado. Presiona Ctrl+C para detener."
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
