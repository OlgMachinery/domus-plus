#!/bin/bash

# Script completo para configurar entorno e inicializar base de datos

echo "🚀 Configurando DOMUS+ Backend..."

cd "$(dirname "$0")"

# 1. Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# 2. Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# 3. Actualizar pip
echo "⬆️  Actualizando pip..."
pip install --upgrade pip --quiet

# 4. Instalar dependencias
echo "📥 Instalando dependencias..."
pip install -r requirements.txt --quiet

# 5. Crear base de datos
echo "🗄️  Creando base de datos SQLite..."
python3 init_db.py

echo ""
echo "✅ ¡Todo listo!"
echo ""
echo "Para iniciar el servidor, ejecuta:"
echo "  cd /Users/gonzalomontanofimbres/domus-plus/backend"
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --reload"

