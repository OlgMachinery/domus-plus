#!/bin/bash

echo "🔄 Actualizando dependencias del Backend DOMUS+..."

cd "$(dirname "$0")/backend"

# Verificar si existe el entorno virtual
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# Actualizar pip
echo "📥 Actualizando pip..."
pip install --upgrade pip

# Actualizar dependencias
echo "📦 Actualizando dependencias (esto puede tardar unos minutos)..."
pip install -r requirements.txt --upgrade

echo "✅ Dependencias actualizadas correctamente"
echo ""
echo "Ahora puedes iniciar el backend con: ./iniciar-backend.sh"
