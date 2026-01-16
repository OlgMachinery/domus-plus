#!/bin/bash
# Script para configurar Twilio automáticamente

cd "$(dirname "$0")"

echo "📱 Configuración de Twilio para DOMUS+"
echo "========================================"
echo ""

# Verificar si existe .env
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Archivo .env creado desde .env.example"
    else
        touch .env
        echo "✅ Archivo .env creado"
    fi
fi

echo ""
echo "🔑 Necesitas las siguientes credenciales de Twilio:"
echo "   1. Account SID"
echo "   2. Auth Token"
echo "   3. Número de WhatsApp"
echo ""
echo "📋 Puedes obtenerlas en: https://console.twilio.com/"
echo ""

# Solicitar credenciales
read -p "Ingresa tu TWILIO_ACCOUNT_SID: " account_sid
read -p "Ingresa tu TWILIO_AUTH_TOKEN: " auth_token
read -p "Ingresa tu TWILIO_WHATSAPP_NUMBER (ej: whatsapp:+14155238886): " whatsapp_number

# Validar que no estén vacías
if [ -z "$account_sid" ] || [ -z "$auth_token" ] || [ -z "$whatsapp_number" ]; then
    echo "❌ Error: Todas las credenciales son requeridas"
    exit 1
fi

# Actualizar o agregar las variables en .env
echo ""
echo "📝 Actualizando archivo .env..."

# Eliminar líneas existentes si las hay
sed -i.bak '/^TWILIO_ACCOUNT_SID=/d' .env
sed -i.bak '/^TWILIO_AUTH_TOKEN=/d' .env
sed -i.bak '/^TWILIO_WHATSAPP_NUMBER=/d' .env

# Agregar las nuevas credenciales
echo "TWILIO_ACCOUNT_SID=$account_sid" >> .env
echo "TWILIO_AUTH_TOKEN=$auth_token" >> .env
echo "TWILIO_WHATSAPP_NUMBER=$whatsapp_number" >> .env

echo "✅ Credenciales configuradas en .env"
echo ""

# Verificar instalación de Twilio
echo "🔍 Verificando instalación de Twilio..."
if [ -d "venv" ]; then
    source venv/bin/activate
    if pip show twilio > /dev/null 2>&1; then
        echo "✅ Twilio está instalado"
    else
        echo "📦 Instalando Twilio..."
        pip install twilio
        echo "✅ Twilio instalado"
    fi
else
    echo "⚠️  Entorno virtual no encontrado. Instala Twilio manualmente:"
    echo "   pip install twilio"
fi

echo ""
echo "✅ Configuración completada!"
echo ""
echo "🔍 Verificando configuración..."
python3 verificar_whatsapp.py

echo ""
echo "📋 Próximos pasos:"
echo "   1. Configura el webhook en Twilio Console"
echo "   2. Si estás en desarrollo local, usa ngrok para exponer tu servidor"
echo "   3. Lee CONFIGURAR_WHATSAPP.md para más detalles"
