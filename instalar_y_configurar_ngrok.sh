#!/bin/bash
# Script para instalar y configurar ngrok

cd "$(dirname "$0")"

echo "📦 Instalando y configurando ngrok..."
echo ""

# Verificar si ngrok ya está instalado
if command -v ngrok &> /dev/null; then
    echo "✅ ngrok ya está instalado"
    NGROK_INSTALLED=true
else
    echo "📥 Descargando ngrok..."
    
    # Detectar sistema operativo
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "📦 Instalando con Homebrew..."
            brew install ngrok/ngrok/ngrok
            NGROK_INSTALLED=$?
        else
            echo "⚠️  Homebrew no está instalado"
            echo "📥 Descargando ngrok para macOS..."
            curl -o /tmp/ngrok.zip https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip
            unzip -o /tmp/ngrok.zip -d /usr/local/bin/ 2>/dev/null || unzip -o /tmp/ngrok.zip -d ~/bin/ 2>/dev/null
            chmod +x /usr/local/bin/ngrok 2>/dev/null || chmod +x ~/bin/ngrok 2>/dev/null
            NGROK_INSTALLED=$?
        fi
    else
        echo "⚠️  Por favor, instala ngrok manualmente desde: https://ngrok.com/download"
        exit 1
    fi
fi

if [ "$NGROK_INSTALLED" = true ] || [ $? -eq 0 ]; then
    echo "✅ ngrok instalado correctamente"
    echo ""
    
    # Verificar si ngrok está corriendo
    if lsof -ti:4040 &> /dev/null; then
        echo "⚠️  ngrok ya está corriendo en el puerto 4040"
        read -p "¿Quieres detenerlo y reiniciarlo? (s/n): " respuesta
        if [[ "$respuesta" =~ ^[Ss]$ ]]; then
            kill $(lsof -ti:4040) 2>/dev/null
            sleep 2
        else
            echo "✅ Usando ngrok existente"
            exit 0
        fi
    fi
    
    echo "🚀 Iniciando ngrok en el puerto 8000..."
    echo "   (Esto expondrá tu servidor local a internet)"
    echo ""
    
    # Iniciar ngrok en background
    ngrok http 8000 --log=stdout > /tmp/ngrok.log 2>&1 &
    NGROK_PID=$!
    
    echo "⏳ Esperando que ngrok inicie..."
    sleep 5
    
    # Obtener URL
    URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    https_tunnel = next((t for t in tunnels if t.get('proto') == 'https'), None)
    if https_tunnel:
        print(https_tunnel.get('public_url', ''))
except:
    pass
" 2>/dev/null)
    
    if [ -n "$URL" ]; then
        WEBHOOK_URL="${URL}/api/whatsapp/webhook"
        echo ""
        echo "✅ ngrok está corriendo!"
        echo ""
        echo "📋 INFORMACIÓN IMPORTANTE:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🌐 URL pública de ngrok:"
        echo "   $URL"
        echo ""
        echo "📱 URL del Webhook para Twilio:"
        echo "   $WEBHOOK_URL"
        echo ""
        echo "💡 CONFIGURA ESTO EN TWILIO:"
        echo "   1. Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox"
        echo "   2. En 'A MESSAGE COMES IN', pega esta URL:"
        echo "      $WEBHOOK_URL"
        echo "   3. Método: POST"
        echo "   4. Haz clic en 'Save'"
        echo ""
        echo "⚠️  IMPORTANTE: Esta URL cambiará cada vez que reinicies ngrok"
        echo "   Si reinicias ngrok, deberás actualizar la URL en Twilio"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📊 Para ver el dashboard de ngrok: http://localhost:4040"
        echo "🛑 Para detener ngrok: kill $NGROK_PID"
        echo ""
        
        # Guardar URL en archivo
        echo "$WEBHOOK_URL" > /tmp/ngrok_webhook_url.txt
        echo "✅ URL guardada en /tmp/ngrok_webhook_url.txt"
    else
        echo "⚠️  ngrok inició pero no se pudo obtener la URL"
        echo "   Revisa los logs: tail -f /tmp/ngrok.log"
        echo "   O ve al dashboard: http://localhost:4040"
    fi
else
    echo "❌ Error al instalar ngrok"
    echo "   Instala manualmente desde: https://ngrok.com/download"
    exit 1
fi
