#!/usr/bin/env python3
"""
Script de diagnóstico completo para problemas con Twilio/WhatsApp
"""
import os
import sys
import requests
from pathlib import Path

# Cargar variables de entorno
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    env_file = Path(__file__).parent / '.env'
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value.strip('"').strip("'")

print("="*70)
print("🔍 DIAGNÓSTICO COMPLETO DE TWILIO/WHATSAPP")
print("="*70)
print()

# 1. Verificar biblioteca Twilio
print("1️⃣ Verificando biblioteca Twilio...")
try:
    from twilio.rest import Client
    from twilio.twiml.messaging_response import MessagingResponse
    print("   ✅ Biblioteca 'twilio' instalada")
    TWILIO_LIB_OK = True
except ImportError:
    print("   ❌ Biblioteca 'twilio' NO está instalada")
    print("      Instala con: pip install twilio")
    TWILIO_LIB_OK = False
    sys.exit(1)

# 2. Verificar credenciales
print("\n2️⃣ Verificando credenciales de Twilio...")
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
whatsapp_number = os.getenv("TWILIO_WHATSAPP_NUMBER")

credenciales_ok = True

if account_sid:
    masked = f"{account_sid[:10]}...{account_sid[-4:]}" if len(account_sid) > 14 else "***"
    print(f"   ✅ TWILIO_ACCOUNT_SID: {masked}")
else:
    print("   ❌ TWILIO_ACCOUNT_SID NO configurada")
    credenciales_ok = False

if auth_token:
    masked = f"{auth_token[:7]}...{auth_token[-4:]}" if len(auth_token) > 11 else "***"
    print(f"   ✅ TWILIO_AUTH_TOKEN: {masked}")
else:
    print("   ❌ TWILIO_AUTH_TOKEN NO configurada")
    credenciales_ok = False

if whatsapp_number:
    print(f"   ✅ TWILIO_WHATSAPP_NUMBER: {whatsapp_number}")
else:
    print("   ❌ TWILIO_WHATSAPP_NUMBER NO configurada")
    credenciales_ok = False

# 3. Verificar cliente Twilio
print("\n3️⃣ Verificando cliente Twilio...")
if credenciales_ok:
    try:
        client = Client(account_sid, auth_token)
        account = client.api.accounts(account_sid).fetch()
        print(f"   ✅ Cliente Twilio inicializado correctamente")
        print(f"   ✅ Cuenta verificada: {account.friendly_name}")
    except Exception as e:
        print(f"   ❌ Error al inicializar cliente: {str(e)}")
        print("      Verifica que las credenciales sean correctas")
else:
    print("   ⚠️  No se puede verificar (faltan credenciales)")

# 4. Verificar servicio de WhatsApp
print("\n4️⃣ Verificando servicio de WhatsApp...")
try:
    from app.services import whatsapp_service
    if whatsapp_service.TWILIO_AVAILABLE:
        print("   ✅ Servicio de WhatsApp disponible")
        if whatsapp_service.client:
            print("   ✅ Cliente configurado en el servicio")
        else:
            print("   ⚠️  Cliente NO configurado en el servicio")
    else:
        print("   ❌ Servicio de WhatsApp NO disponible")
except Exception as e:
    print(f"   ❌ Error al importar servicio: {e}")

# 5. Verificar endpoint del webhook
print("\n5️⃣ Verificando endpoint del webhook...")
try:
    from app.main import app
    routes = [route.path for route in app.routes]
    webhook_path = "/api/whatsapp/webhook"
    if webhook_path in routes:
        print(f"   ✅ Webhook registrado: {webhook_path}")
    else:
        print(f"   ❌ Webhook NO registrado: {webhook_path}")
        print("      Verifica que el router esté incluido en main.py")
except Exception as e:
    print(f"   ⚠️  No se pudo verificar: {e}")

# 6. Probar endpoint localmente
print("\n6️⃣ Probando endpoint localmente...")
try:
    test_data = {
        "From": "whatsapp:+525551234567",
        "Body": "test",
        "MessageSid": "test_sid_123"
    }
    response = requests.post("http://localhost:8000/api/whatsapp/webhook", data=test_data, timeout=5)
    if response.status_code == 200:
        print("   ✅ Endpoint responde correctamente (200 OK)")
        print(f"   📄 Respuesta: {response.text[:100]}...")
    else:
        print(f"   ⚠️  Endpoint responde con código: {response.status_code}")
except requests.exceptions.ConnectionError:
    print("   ❌ No se puede conectar al servidor local")
    print("      Asegúrate de que el backend esté corriendo en http://localhost:8000")
except Exception as e:
    print(f"   ⚠️  Error al probar endpoint: {e}")

# 7. Verificar configuración del webhook en Twilio
print("\n7️⃣ Configuración del Webhook en Twilio:")
print("   📋 URL que debe estar configurada:")
print("      https://tu-dominio.com/api/whatsapp/webhook")
print("   📋 O si usas ngrok:")
print("      https://tu-url-ngrok.ngrok.io/api/whatsapp/webhook")
print()
print("   🔗 Ve a configurar:")
print("      https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox")
print()
print("   ⚠️  IMPORTANTE:")
print("      - El servidor debe ser accesible desde internet")
print("      - Si estás en desarrollo local, usa ngrok:")
print("        ngrok http 8000")
print("      - La URL debe usar HTTPS (no HTTP)")

# 8. Verificar usuarios en la base de datos
print("\n8️⃣ Verificando usuarios registrados...")
try:
    from app.database import SessionLocal
    from app import models
    
    db = SessionLocal()
    users = db.query(models.User).all()
    print(f"   📊 Total de usuarios registrados: {len(users)}")
    
    if users:
        print("   📱 Números de teléfono registrados:")
        for user in users[:5]:  # Mostrar solo los primeros 5
            print(f"      - {user.phone} ({user.name})")
        if len(users) > 5:
            print(f"      ... y {len(users) - 5} más")
    else:
        print("   ⚠️  No hay usuarios registrados")
        print("      Los mensajes de WhatsApp necesitan un usuario registrado")
    
    db.close()
except Exception as e:
    print(f"   ⚠️  Error al verificar usuarios: {e}")

# 9. Resumen y recomendaciones
print("\n" + "="*70)
print("📋 RESUMEN Y RECOMENDACIONES")
print("="*70)

problemas = []

if not credenciales_ok:
    problemas.append("❌ Credenciales de Twilio no configuradas")
    print("\n🔧 SOLUCIÓN:")
    print("   1. Ve a: https://console.twilio.com/")
    print("   2. Obtén Account SID y Auth Token")
    print("   3. Configura en .env:")
    print("      TWILIO_ACCOUNT_SID=tu-account-sid")
    print("      TWILIO_AUTH_TOKEN=tu-auth-token")
    print("      TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886")

print("\n🔧 CONFIGURAR WEBHOOK EN TWILIO:")
print("   1. Ve a: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox")
print("   2. En 'A MESSAGE COMES IN':")
print("      - URL: https://tu-dominio.com/api/whatsapp/webhook")
print("      - Método: POST")
print("   3. Guarda los cambios")

print("\n🔧 SI ESTÁS EN DESARROLLO LOCAL:")
print("   1. Instala ngrok: https://ngrok.com/download")
print("   2. Ejecuta: ngrok http 8000")
print("   3. Copia la URL HTTPS que ngrok te da")
print("   4. Úsala en la configuración del webhook de Twilio")

print("\n🔧 VERIFICAR QUE EL SERVIDOR ESTÉ CORRIENDO:")
print("   El backend debe estar corriendo en: http://localhost:8000")
print("   Verifica con: curl http://localhost:8000/health")

print("\n" + "="*70)
