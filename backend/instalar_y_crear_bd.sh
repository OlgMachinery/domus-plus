#!/bin/bash

# Script para instalar dependencias y crear la base de datos

echo "📦 Instalando dependencias..."
pip install -r requirements.txt

echo ""
echo "🗄️  Creando base de datos..."
python3 crear_bd.py

echo ""
echo "✅ ¡Listo! Ahora puedes iniciar el servidor con:"
echo "   uvicorn app.main:app --reload"

