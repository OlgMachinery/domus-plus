#!/usr/bin/env python3
"""
Script para verificar y configurar el webhook de WhatsApp automáticamente.
"""
import requests
import json
import sys
import os

print("\n" + "="*70)
print("🔍 VERIFICANDO CONFIGURACIÓN DE WHATSAPP")
print("="*70 + "\n")

# 1. Verificar ngrok
print("1️⃣ VERIFICANDO NGROK:")
print("-" * 70)
try:
    response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
    if response.status_code == 200:
        data = response.json()
        tunnels = data.get('tunnels', [])
        https_tunnel = next((t for t in tunnels if t.get('proto') == 'https'), None)
        if https_tunnel:
            ngrok_url = https_tunnel.get('public_url')
            webhook_url = f"{ngrok_url}/api/whatsapp/webhook"
            print(f"   ✅ ngrok está corriendo")
            print(f"   📍 URL pública: {ngrok_url}")
            print(f"   🔗 Webhook URL: {webhook_url}\n")
            
            # Guardar la URL en un archivo
            with open('URL_WEBHOOK_TWILIO.txt', 'w') as f:
                f.write(f"URL del webhook para Twilio:\n{webhook_url}\n\n")
                f.write("Configura esta URL en:\n")
                f.write("https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox\n\n")
                f.write("En el campo 'When a message comes in', pega la URL de arriba.\n")
                f.write("Método: POST\n")
            
            print(f"   💾 URL guardada en: URL_WEBHOOK_TWILIO.txt\n")
        else:
            print("   ⚠️  ngrok está corriendo pero no hay túneles HTTPS activos\n")
            sys.exit(1)
    else:
        print("   ❌ ngrok no está respondiendo en el puerto 4040\n")
        print("   💡 Ejecuta: ngrok http 8000\n")
        sys.exit(1)
except requests.exceptions.RequestException:
    print("   ❌ ngrok no está corriendo\n")
    print("   💡 Ejecuta: ngrok http 8000\n")
    sys.exit(1)

# 2. Verificar backend
print("2️⃣ VERIFICANDO BACKEND:")
print("-" * 70)
try:
    response = requests.get('http://localhost:8000/docs', timeout=2)
    if response.status_code == 200 and 'FastAPI' in response.text:
        print("   ✅ Backend está corriendo en puerto 8000\n")
    else:
        print("   ❌ Backend no está respondiendo correctamente\n")
        print("   💡 Ejecuta: cd backend && source venv/bin/activate && python3 -m uvicorn app.main:app --reload --port 8000\n")
        sys.exit(1)
except requests.exceptions.RequestException:
    print("   ❌ Backend no está corriendo en puerto 8000\n")
    print("   💡 Ejecuta: cd backend && source venv/bin/activate && python3 -m uvicorn app.main:app --reload --port 8000\n")
    sys.exit(1)

# 3. Probar el webhook
print("3️⃣ PROBANDO WEBHOOK:")
print("-" * 70)
try:
    test_data = {
        'From': 'whatsapp:+5216865690472',
        'Body': 'test',
        'MessageSid': 'test123'
    }
    response = requests.post(webhook_url, data=test_data, timeout=5)
    if response.status_code == 200:
        print(f"   ✅ Webhook responde correctamente (Status: {response.status_code})\n")
    else:
        print(f"   ⚠️  Webhook responde con status: {response.status_code}\n")
except requests.exceptions.RequestException as e:
    print(f"   ⚠️  No se pudo probar el webhook: {e}\n")
    print("   (Esto puede ser normal si ngrok requiere autenticación)\n")

# Resumen
print("="*70)
print("\n📋 RESUMEN:")
print("-" * 70)
print(f"✅ ngrok: Corriendo - {ngrok_url}")
print(f"✅ Backend: Corriendo en puerto 8000")
print(f"📋 Webhook URL: {webhook_url}")
print("\n📝 PRÓXIMOS PASOS:")
print("   1. Abre: URL_WEBHOOK_TWILIO.txt")
print("   2. Copia la URL del webhook")
print("   3. Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox")
print("   4. Pega la URL en 'When a message comes in'")
print("   5. Método: POST")
print("   6. Guarda")
print("\n" + "="*70 + "\n")
