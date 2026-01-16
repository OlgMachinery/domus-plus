#!/usr/bin/env python3
"""
Script para probar el webhook de Twilio localmente
Simula una petición de Twilio
"""
import requests
import sys

WEBHOOK_URL = "http://localhost:8000/api/whatsapp/webhook"

def probar_webhook_texto():
    """Prueba el webhook con un mensaje de texto"""
    print("📱 Probando webhook con mensaje de texto...\n")
    
    data = {
        "From": "whatsapp:+525551234567",
        "Body": "saldo",
        "MessageSid": "test_message_sid_123"
    }
    
    try:
        response = requests.post(WEBHOOK_URL, data=data, timeout=10)
        print(f"✅ Status Code: {response.status_code}")
        print(f"📄 Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"📄 Response:\n{response.text}")
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        print("❌ Error: No se puede conectar al servidor")
        print("   Asegúrate de que el backend esté corriendo en http://localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

def probar_webhook_sin_usuario():
    """Prueba el webhook con un número no registrado"""
    print("\n📱 Probando webhook con número no registrado...\n")
    
    data = {
        "From": "whatsapp:+999999999999",
        "Body": "test",
        "MessageSid": "test_message_sid_456"
    }
    
    try:
        response = requests.post(WEBHOOK_URL, data=data, timeout=10)
        print(f"✅ Status Code: {response.status_code}")
        print(f"📄 Response:\n{response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    print("="*70)
    print("🧪 PRUEBA DEL WEBHOOK DE TWILIO")
    print("="*70)
    print()
    
    # Verificar que el servidor esté corriendo
    try:
        health = requests.get("http://localhost:8000/health", timeout=5)
        if health.status_code == 200:
            print("✅ Servidor backend está corriendo\n")
        else:
            print("⚠️  Servidor responde pero con código:", health.status_code)
    except:
        print("❌ El servidor backend NO está corriendo")
        print("   Inicia el servidor con:")
        print("   cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        sys.exit(1)
    
    # Probar webhook
    resultado1 = probar_webhook_texto()
    resultado2 = probar_webhook_sin_usuario()
    
    print("\n" + "="*70)
    if resultado1 and resultado2:
        print("✅ TODAS LAS PRUEBAS PASARON")
        print("\n💡 El webhook está funcionando correctamente")
        print("   Verifica que la URL esté configurada en Twilio:")
        print("   https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox")
    else:
        print("⚠️  ALGUNAS PRUEBAS FALLARON")
        print("   Revisa los errores arriba")
    print("="*70)
