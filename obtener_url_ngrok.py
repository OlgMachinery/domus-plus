#!/usr/bin/env python3
"""
Script para obtener la URL pública de ngrok y configurar el webhook en Twilio
"""
import requests
import json
import time
import sys

def obtener_url_ngrok():
    """Obtiene la URL pública de ngrok"""
    max_intentos = 10
    for i in range(max_intentos):
        try:
            response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
            if response.status_code == 200:
                data = response.json()
                tunnels = data.get('tunnels', [])
                https_tunnel = next((t for t in tunnels if t.get('proto') == 'https'), None)
                if https_tunnel:
                    return https_tunnel.get('public_url')
        except:
            pass
        if i < max_intentos - 1:
            time.sleep(1)
    return None

if __name__ == "__main__":
    print("🔍 Obteniendo URL de ngrok...")
    url = obtener_url_ngrok()
    
    if url:
        webhook_url = f"{url}/api/whatsapp/webhook"
        print(f"\n✅ URL de ngrok obtenida:")
        print(f"   {url}")
        print(f"\n📋 URL del Webhook para Twilio:")
        print(f"   {webhook_url}")
        print(f"\n💡 Configura esta URL en Twilio:")
        print(f"   1. Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox")
        print(f"   2. En 'A MESSAGE COMES IN', pega: {webhook_url}")
        print(f"   3. Método: POST")
        print(f"   4. Guarda")
    else:
        print("❌ No se pudo obtener la URL de ngrok")
        print("   Asegúrate de que ngrok esté corriendo:")
        print("   ngrok http 8000")
        sys.exit(1)
