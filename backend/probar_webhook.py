#!/usr/bin/env python3
"""
Script para probar el webhook de WhatsApp localmente
Simula una petición de Twilio al webhook
"""
import requests
import base64
import sys

# URL del webhook (ajusta según tu configuración)
WEBHOOK_URL = "http://localhost:8000/api/whatsapp/webhook"

def probar_webhook_con_texto():
    """Prueba el webhook con un mensaje de texto"""
    print("📱 Probando webhook con mensaje de texto...\n")
    
    data = {
        "From": "whatsapp:+525551234567",  # Número de prueba
        "Body": "saldo",
        "MessageSid": "test_message_sid_123"
    }
    
    try:
        response = requests.post(WEBHOOK_URL, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response:\n{response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def probar_webhook_con_imagen(ruta_imagen):
    """Prueba el webhook con una imagen de recibo"""
    print(f"📱 Probando webhook con imagen: {ruta_imagen}\n")
    
    # Leer y codificar la imagen
    try:
        with open(ruta_imagen, 'rb') as f:
            image_data = f.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
    except FileNotFoundError:
        print(f"❌ Archivo no encontrado: {ruta_imagen}")
        return False
    except Exception as e:
        print(f"❌ Error al leer imagen: {str(e)}")
        return False
    
    # Simular URL de media de Twilio (en producción sería una URL real)
    media_url = f"data:image/jpeg;base64,{image_base64}"
    
    data = {
        "From": "whatsapp:+525551234567",  # Número de prueba (debe estar registrado)
        "MediaUrl0": media_url,
        "MessageSid": "test_message_sid_456"
    }
    
    try:
        print("⚠️  Nota: Esta prueba simula el webhook, pero Twilio requiere una URL real.")
        print("   Para probar completamente, necesitas configurar ngrok y el webhook en Twilio.\n")
        
        response = requests.post(WEBHOOK_URL, data=data, timeout=90)
        print(f"Status Code: {response.status_code}")
        print(f"Response:\n{response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("PRUEBA DE WEBHOOK DE WHATSAPP")
    print("="*60)
    print()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "texto":
            probar_webhook_con_texto()
        elif sys.argv[1] == "imagen" and len(sys.argv) > 2:
            probar_webhook_con_imagen(sys.argv[2])
        else:
            print("Uso:")
            print("  python3 probar_webhook.py texto")
            print("  python3 probar_webhook.py imagen ruta/a/imagen.jpg")
    else:
        print("Uso:")
        print("  python3 probar_webhook.py texto")
        print("  python3 probar_webhook.py imagen ruta/a/imagen.jpg")
        print()
        print("Ejemplos:")
        print("  python3 probar_webhook.py texto")
        print("  python3 probar_webhook.py imagen /ruta/recibo.jpg")
