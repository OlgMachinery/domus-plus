#!/bin/bash

# Script para instalar dependencias del backend DOMUS+

set -e  # Salir si hay errores

echo "🔧 Instalando dependencias del Backend DOMUS+"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python3 no está instalado"
    exit 1
fi

echo "✅ Python3 encontrado: $(python3 --version)"
echo ""

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
    echo "✅ Entorno virtual creado"
else
    echo "✅ Entorno virtual ya existe"
fi

echo ""
echo "🔌 Activando entorno virtual..."
source venv/bin/activate

echo ""
echo "📥 Actualizando pip..."
pip install --upgrade pip --quiet

echo ""
echo "📥 Instalando dependencias desde requirements.txt..."
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "✅ ¡Instalación completada exitosamente!"
echo "=========================================="
echo ""
echo "Para iniciar el backend, ejecuta:"
echo "  ./iniciar_backend.sh"
echo ""
echo "O manualmente:"
echo "  source venv/bin/activate"
echo "  python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo ""
