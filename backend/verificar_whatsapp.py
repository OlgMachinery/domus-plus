#!/usr/bin/env python3
"""
Script para verificar que Twilio está correctamente configurado
y puede recibir mensajes de WhatsApp
"""
import os
import sys

# Cargar variables de entorno desde .env
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Si dotenv no está instalado, intentar cargar manualmente
    env_file = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

print("📱 Verificando configuración de WhatsApp/Twilio...\n")

# 1. Verificar que Twilio está instalado
try:
    from twilio.rest import Client
    from twilio.twiml.messaging_response import MessagingResponse
    print("✅ Biblioteca 'twilio' instalada")
except ImportError:
    print("❌ Biblioteca 'twilio' NO está instalada")
    print("   Instala con: pip install twilio")
    sys.exit(1)

# 2. Verificar que el servicio está disponible
try:
    from app.services import whatsapp_service
    print("✅ Servicio 'whatsapp_service' disponible")
except ImportError as e:
    print(f"❌ Error al importar whatsapp_service: {e}")
    sys.exit(1)

# 3. Verificar credenciales de Twilio
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
whatsapp_number = os.getenv("TWILIO_WHATSAPP_NUMBER")

if account_sid:
    masked_sid = f"{account_sid[:10]}...{account_sid[-4:]}" if len(account_sid) > 14 else "***"
    print(f"✅ TWILIO_ACCOUNT_SID configurada: {masked_sid}")
else:
    print("❌ TWILIO_ACCOUNT_SID NO está configurada")
    print("   Configura en .env: TWILIO_ACCOUNT_SID=tu-account-sid")

if auth_token:
    masked_token = f"{auth_token[:7]}...{auth_token[-4:]}" if len(auth_token) > 11 else "***"
    print(f"✅ TWILIO_AUTH_TOKEN configurada: {masked_token}")
else:
    print("❌ TWILIO_AUTH_TOKEN NO está configurada")
    print("   Configura en .env: TWILIO_AUTH_TOKEN=tu-auth-token")

if whatsapp_number:
    print(f"✅ TWILIO_WHATSAPP_NUMBER configurada: {whatsapp_number}")
else:
    print("❌ TWILIO_WHATSAPP_NUMBER NO está configurada")
    print("   Configura en .env: TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886")

# 4. Verificar que el cliente está inicializado
if whatsapp_service.TWILIO_AVAILABLE:
    print("✅ Twilio está disponible en el módulo")
    
    if whatsapp_service.client:
        print("✅ Cliente Twilio inicializado correctamente")
    else:
        print("⚠️  Cliente Twilio NO está inicializado (faltan credenciales)")
else:
    print("❌ Twilio NO está disponible en el módulo")

# 5. Verificar el endpoint del webhook
print("\n📋 Endpoint del Webhook:")
print("   POST /api/whatsapp/webhook")
print("\n💡 Configuración en Twilio:")
print("   1. Ve a: https://console.twilio.com/")
print("   2. Messaging → Settings → WhatsApp Sandbox")
print("   3. En 'A MESSAGE COMES IN', configura:")
print("      URL: https://tu-dominio.com/api/whatsapp/webhook")
print("      Método: POST")

# 6. Verificar que el router está incluido
try:
    from app.main import app
    routes = [route.path for route in app.routes]
    if "/api/whatsapp/webhook" in routes:
        print("\n✅ Webhook está registrado en la aplicación")
    else:
        print("\n⚠️  Webhook NO está registrado en la aplicación")
        print("   Verifica que el router de WhatsApp esté incluido en main.py")
except Exception as e:
    print(f"\n⚠️  No se pudo verificar el registro del webhook: {e}")

# 7. Resumen
print("\n" + "="*60)
if account_sid and auth_token and whatsapp_number and whatsapp_service.client:
    print("✅ WhatsApp/Twilio está COMPLETAMENTE CONFIGURADO")
    print("\n💡 Próximos pasos:")
    print("   1. Configura el webhook en la consola de Twilio")
    print("   2. Asegúrate de que tu servidor sea accesible desde internet")
    print("   3. Si estás en desarrollo local, usa ngrok para exponer el servidor")
    print("   4. Envía un mensaje de prueba por WhatsApp")
else:
    print("⚠️  WhatsApp/Twilio NO está completamente configurado")
    if not account_sid:
        print("\n   Acción requerida: Configurar TWILIO_ACCOUNT_SID")
    if not auth_token:
        print("\n   Acción requerida: Configurar TWILIO_AUTH_TOKEN")
    if not whatsapp_number:
        print("\n   Acción requerida: Configurar TWILIO_WHATSAPP_NUMBER")
print("="*60)
