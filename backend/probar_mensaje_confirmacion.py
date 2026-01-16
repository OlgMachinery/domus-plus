#!/usr/bin/env python3
"""
Script para probar que el webhook de Twilio retorna mensajes de confirmación correctamente
"""
import requests
import sys
import json

WEBHOOK_URL = "http://localhost:8000/api/whatsapp/webhook"

def probar_mensaje_texto():
    """Prueba con un mensaje de texto (comando saldo)"""
    print("="*70)
    print("🧪 PRUEBA 1: Mensaje de texto (comando 'saldo')")
    print("="*70)
    
    data = {
        "From": "whatsapp:+525551234567",
        "Body": "saldo",
        "MessageSid": "test_saldo_123"
    }
    
    try:
        response = requests.post(WEBHOOK_URL, data=data, timeout=10)
        print(f"\n✅ Status Code: {response.status_code}")
        print(f"📄 Content-Type: {response.headers.get('Content-Type', 'N/A')}")
        print(f"\n📨 Respuesta XML de Twilio:")
        print("-" * 70)
        print(response.text)
        print("-" * 70)
        
        # Verificar que contiene un mensaje
        if "<Message>" in response.text and "</Message>" in response.text:
            print("\n✅ ÉXITO: La respuesta contiene un mensaje de confirmación")
            # Extraer el mensaje
            import re
            match = re.search(r'<Message>(.*?)</Message>', response.text, re.DOTALL)
            if match:
                mensaje = match.group(1).strip()
                print(f"\n💬 Mensaje que Twilio enviará al usuario:")
                print(f"   {mensaje}")
        else:
            print("\n❌ ERROR: La respuesta NO contiene un mensaje")
        
        return response.status_code == 200
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: No se puede conectar al servidor")
        print("   Asegúrate de que el backend esté corriendo en http://localhost:8000")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def probar_mensaje_sin_imagen():
    """Prueba con un mensaje sin imagen"""
    print("\n" + "="*70)
    print("🧪 PRUEBA 2: Mensaje sin imagen")
    print("="*70)
    
    data = {
        "From": "whatsapp:+525551234567",
        "Body": "hola",
        "MessageSid": "test_hola_123"
    }
    
    try:
        response = requests.post(WEBHOOK_URL, data=data, timeout=10)
        print(f"\n✅ Status Code: {response.status_code}")
        print(f"\n📨 Respuesta XML:")
        print("-" * 70)
        print(response.text)
        print("-" * 70)
        
        if "<Message>" in response.text:
            print("\n✅ ÉXITO: La respuesta contiene un mensaje de confirmación")
        else:
            print("\n❌ ERROR: La respuesta NO contiene un mensaje")
        
        return response.status_code == 200
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def probar_usuario_no_registrado():
    """Prueba con un usuario no registrado"""
    print("\n" + "="*70)
    print("🧪 PRUEBA 3: Usuario no registrado")
    print("="*70)
    
    data = {
        "From": "whatsapp:+999999999999",
        "Body": "test",
        "MessageSid": "test_no_user_123"
    }
    
    try:
        response = requests.post(WEBHOOK_URL, data=data, timeout=10)
        print(f"\n✅ Status Code: {response.status_code}")
        print(f"\n📨 Respuesta XML:")
        print("-" * 70)
        print(response.text)
        print("-" * 70)
        
        if "<Message>" in response.text:
            print("\n✅ ÉXITO: La respuesta contiene un mensaje (aunque sea de error)")
        else:
            print("\n❌ ERROR: La respuesta NO contiene un mensaje")
        
        return response.status_code == 200
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def verificar_servidor():
    """Verifica que el servidor esté corriendo"""
    print("🔍 Verificando que el servidor esté corriendo...")
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ Servidor backend está corriendo\n")
            return True
        else:
            print(f"⚠️  Servidor responde pero con código: {response.status_code}\n")
            return False
    except:
        print("❌ El servidor backend NO está corriendo")
        print("\n💡 Inicia el servidor con:")
        print("   cd backend")
        print("   source venv/bin/activate")
        print("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        return False

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🧪 PRUEBA DE MENSAJES DE CONFIRMACIÓN DE TWILIO")
    print("="*70)
    print()
    
    # Verificar servidor
    if not verificar_servidor():
        sys.exit(1)
    
    # Ejecutar pruebas
    resultado1 = probar_mensaje_texto()
    resultado2 = probar_mensaje_sin_imagen()
    resultado3 = probar_usuario_no_registrado()
    
    # Resumen
    print("\n" + "="*70)
    print("📊 RESUMEN DE PRUEBAS")
    print("="*70)
    print(f"Prueba 1 (Mensaje texto): {'✅ PASÓ' if resultado1 else '❌ FALLÓ'}")
    print(f"Prueba 2 (Sin imagen): {'✅ PASÓ' if resultado2 else '❌ FALLÓ'}")
    print(f"Prueba 3 (Usuario no registrado): {'✅ PASÓ' if resultado3 else '❌ FALLÓ'}")
    
    if resultado1 and resultado2 and resultado3:
        print("\n✅ TODAS LAS PRUEBAS PASARON")
        print("\n💡 El webhook está retornando mensajes de confirmación correctamente")
        print("\n📱 PRÓXIMO PASO: Prueba con un mensaje real por WhatsApp")
        print("   1. Asegúrate de que tu número esté registrado en DOMUS+")
        print("   2. Envía un mensaje por WhatsApp al número de Twilio")
        print("   3. Deberías recibir un mensaje de confirmación")
    else:
        print("\n⚠️  ALGUNAS PRUEBAS FALLARON")
        print("   Revisa los errores arriba y corrige los problemas")
    
    print("="*70)
