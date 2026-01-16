#!/bin/bash

# Script para crear la base de datos SQLite

echo "🗄️  Creando base de datos SQLite para DOMUS+..."

cd "$(dirname "$0")"

# Verificar si existe el entorno virtual
if [ ! -d "venv" ]; then
    echo "⚠️  Creando entorno virtual..."
    python3 -m venv venv
fi

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias si es necesario
if [ ! -f "venv/.installed" ]; then
    echo "📥 Instalando dependencias..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Ejecutar script de inicialización
echo "🔧 Inicializando base de datos..."
python3 init_db.py

echo ""
echo "✅ ¡Base de datos creada exitosamente!"
echo "📁 Archivo: $(pwd)/domus_plus.db"

