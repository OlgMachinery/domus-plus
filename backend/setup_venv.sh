#!/bin/bash

# Script para configurar entorno virtual y instalar dependencias

echo "🔧 Configurando entorno virtual para DOMUS+ Backend..."
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
echo "📥 Instalando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✅ ¡Configuración completada!"
echo ""
echo "Para usar el entorno virtual en el futuro:"
echo "  source venv/bin/activate"
echo ""
echo "Para iniciar el backend:"
echo "  ./iniciar_backend.sh"
echo ""
