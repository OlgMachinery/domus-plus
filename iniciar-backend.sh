#!/bin/bash

echo "🚀 Iniciando Backend DOMUS+..."

cd "$(dirname "$0")/backend"

# Verificar si existe el entorno virtual
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# Instalar/actualizar dependencias
echo "📥 Instalando/actualizando dependencias..."
pip install --upgrade pip
pip install -r requirements.txt --upgrade
touch venv/.installed

# Usar SQLite (más simple que PostgreSQL)
export DATABASE_URL="sqlite:///./domus_plus.db"

# Iniciar servidor
echo "✅ Iniciando servidor en http://localhost:8000"
echo "📚 Documentación disponible en http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
