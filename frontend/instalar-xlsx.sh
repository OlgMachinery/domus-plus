#!/bin/bash
# Script para instalar la dependencia xlsx necesaria para procesar archivos Excel

echo "Instalando dependencia xlsx..."
cd "$(dirname "$0")"

npm install xlsx

if [ $? -eq 0 ]; then
  echo "✅ xlsx instalado correctamente"
  echo ""
  echo "⚠️  IMPORTANTE: Debes reiniciar el servidor de Next.js para que los cambios surtan efecto."
  echo "   1. Detén el servidor actual (Ctrl+C)"
  echo "   2. Ejecuta: npm run dev"
else
  echo "❌ Error al instalar xlsx"
  exit 1
fi
