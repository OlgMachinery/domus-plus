#!/bin/bash

# Script para iniciar el backend de Domus+

echo "🚀 Iniciando backend de Domus+..."
echo ""

cd "$(dirname "$0")"

# Verificar que estamos en el directorio correcto
if [ ! -f "app/main.py" ]; then
    echo "❌ Error: No se encontró app/main.py"
    echo "   Asegúrate de ejecutar este script desde el directorio backend/"
    exit 1
fi

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python3 no está instalado"
    exit 1
fi

echo "✅ Directorio correcto"
echo "✅ Python3 encontrado"
echo ""

# Verificar variables de entorno
if [ ! -f ".env" ]; then
    echo "⚠️  Advertencia: No se encontró archivo .env"
    echo "   Algunas funcionalidades pueden no funcionar sin configuración"
fi

echo "📦 Iniciando servidor en http://localhost:8000"
echo "   Presiona Ctrl+C para detener"
echo ""
echo "=========================================="
echo ""

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    echo "🔌 Activando entorno virtual..."
    source venv/bin/activate
fi

# Iniciar uvicorn
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
