#!/bin/bash

# Script para instalar Tesseract OCR ahora
# Ejecuta este script con: bash instalar_tesseract_ahora.sh

set -e  # Salir si hay errores

echo "🚀 Instalando Tesseract OCR..."
echo ""

# Verificar si Homebrew está instalado
if ! command -v brew &> /dev/null; then
    echo "📦 Homebrew no está instalado. Instalando Homebrew primero..."
    echo ""
    echo "⚠️  Esto puede pedirte tu contraseña de administrador"
    echo ""
    
    # Intentar encontrar Homebrew en ubicaciones comunes
    if [ -f /opt/homebrew/bin/brew ]; then
        export PATH="/opt/homebrew/bin:$PATH"
        echo "✅ Homebrew encontrado en /opt/homebrew/bin"
    elif [ -f /usr/local/bin/brew ]; then
        export PATH="/usr/local/bin:$PATH"
        echo "✅ Homebrew encontrado en /usr/local/bin"
    else
        echo "📥 Instalando Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Agregar Homebrew al PATH según la arquitectura
        if [ -f /opt/homebrew/bin/brew ]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f /usr/local/bin/brew ]; then
            echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    fi
fi

# Verificar que Homebrew funciona
if ! command -v brew &> /dev/null; then
    echo "❌ Error: Homebrew no está disponible después de la instalación"
    echo "   Por favor, ejecuta manualmente:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

echo "✅ Homebrew disponible: $(brew --version | head -n 1)"
echo ""

# Actualizar Homebrew
echo "🔄 Actualizando Homebrew..."
brew update

# Instalar Tesseract
echo ""
echo "📦 Instalando Tesseract OCR..."
brew install tesseract

# Instalar idiomas (español e inglés)
echo ""
echo "🌍 Instalando idiomas para Tesseract (español e inglés)..."
brew install tesseract-lang || echo "⚠️  tesseract-lang puede no estar disponible, pero Tesseract base está instalado"

# Verificar instalación
echo ""
echo "🔍 Verificando instalación..."
if command -v tesseract &> /dev/null; then
    echo "✅ Tesseract instalado correctamente"
    tesseract --version | head -n 1
    
    echo ""
    echo "📋 Idiomas disponibles:"
    tesseract --list-langs
    
    echo ""
    echo "🎉 ¡Instalación completada exitosamente!"
    echo ""
    echo "✅ Tesseract está listo para usar"
    echo "✅ El sistema ahora usará OCR + GPT Vision para procesar recibos"
    echo ""
    echo "Para verificar, ejecuta: python3 verificar_ocr.py"
else
    echo "❌ Error: Tesseract no se instaló correctamente"
    exit 1
fi
