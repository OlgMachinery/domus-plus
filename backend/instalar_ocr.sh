#!/bin/bash

# Script para instalar Tesseract OCR y dependencias de Python

echo "🔍 Verificando si Tesseract está instalado..."

if command -v tesseract &> /dev/null; then
    echo "✅ Tesseract ya está instalado"
    tesseract --version
else
    echo "📦 Instalando Tesseract OCR..."
    
    # Detectar el sistema operativo
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "Instalando con Homebrew..."
            brew install tesseract tesseract-lang
        else
            echo "❌ Homebrew no está instalado. Por favor instala Homebrew primero:"
            echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo ""
            echo "O instala Tesseract manualmente desde: https://github.com/tesseract-ocr/tesseract"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            echo "Instalando con apt-get..."
            sudo apt-get update
            sudo apt-get install -y tesseract-ocr tesseract-ocr-spa
        elif command -v yum &> /dev/null; then
            echo "Instalando con yum..."
            sudo yum install -y tesseract tesseract-langpack-spa
        else
            echo "❌ No se pudo detectar el gestor de paquetes. Instala Tesseract manualmente."
            exit 1
        fi
    else
        echo "❌ Sistema operativo no soportado. Instala Tesseract manualmente."
        exit 1
    fi
fi

echo ""
echo "📦 Instalando dependencias de Python..."

# Instalar pytesseract
if command -v pip3 &> /dev/null; then
    pip3 install pytesseract
elif command -v pip &> /dev/null; then
    pip install pytesseract
elif command -v python3 &> /dev/null; then
    python3 -m pip install pytesseract
else
    echo "❌ No se encontró pip. Instala Python y pip primero."
    exit 1
fi

echo ""
echo "✅ Instalación completada!"
echo ""
echo "Para verificar que todo funciona, ejecuta:"
echo "  python3 -c \"import pytesseract; print('✅ pytesseract instalado correctamente')\""
echo "  tesseract --version"
