#!/bin/bash

# Script para iniciar el backend de DOMUS+

echo "🚀 Iniciando backend de DOMUS+..."

cd "$(dirname "$0")/backend"

# Verificar si existe el entorno virtual
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# Instalar dependencias si es necesario
if [ ! -f "venv/.installed" ]; then
    echo "📥 Instalando dependencias..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando desde .env.example..."
    cp .env.example .env
    echo "⚠️  IMPORTANTE: Edita el archivo .env con tus credenciales antes de continuar"
    echo "   Presiona Ctrl+C para salir y editar .env"
    read -p "   Presiona Enter cuando hayas editado .env..."
fi

# Iniciar servidor
echo "✅ Iniciando servidor en http://localhost:8000"
echo "📚 Documentación disponible en http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload

