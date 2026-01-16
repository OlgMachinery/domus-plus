#!/bin/bash

# Script simplificado para instalar Tesseract
# Este script asume que Homebrew puede estar en ubicaciones comunes

echo "🔍 Buscando Homebrew..."

# Intentar encontrar Homebrew
if [ -f /opt/homebrew/bin/brew ]; then
    export PATH="/opt/homebrew/bin:$PATH"
    BREW="/opt/homebrew/bin/brew"
    echo "✅ Homebrew encontrado en /opt/homebrew/bin"
elif [ -f /usr/local/bin/brew ]; then
    export PATH="/usr/local/bin:$PATH"
    BREW="/usr/local/bin/brew"
    echo "✅ Homebrew encontrado en /usr/local/bin"
elif command -v brew &> /dev/null; then
    BREW="brew"
    echo "✅ Homebrew encontrado en PATH"
else
    echo "❌ Homebrew no encontrado"
    echo ""
    echo "Por favor ejecuta primero:"
    echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    echo "Luego ejecuta este script nuevamente."
    exit 1
fi

echo ""
echo "📦 Instalando Tesseract OCR..."
$BREW install tesseract

echo ""
echo "🌍 Instalando idiomas..."
$BREW install tesseract-lang || echo "⚠️  tesseract-lang puede no estar disponible"

echo ""
echo "✅ Verificando instalación..."
tesseract --version

echo ""
echo "🎉 ¡Instalación completada!"
echo ""
echo "Ejecuta: python3 verificar_ocr.py"
