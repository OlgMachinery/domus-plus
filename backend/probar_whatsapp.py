#!/usr/bin/env python3
"""
Script para probar el envío de mensajes por WhatsApp usando Twilio
Útil para verificar que la configuración funciona correctamente
"""
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

try:
    from twilio.rest import Client
except ImportError:
    print("❌ Twilio no está instalado. Instala con: pip install twilio")
    exit(1)

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
whatsapp_number = os.getenv("TWILIO_WHATSAPP_NUMBER")

if not all([account_sid, auth_token, whatsapp_number]):
    print("❌ Faltan credenciales de Twilio. Configura en .env:")
    print("   - TWILIO_ACCOUNT_SID")
    print("   - TWILIO_AUTH_TOKEN")
    print("   - TWILIO_WHATSAPP_NUMBER")
    exit(1)

client = Client(account_sid, auth_token)

print("📱 Probando envío de mensaje por WhatsApp...\n")
print(f"Desde: {whatsapp_number}")

# Solicitar número de destino
destino = input("Ingresa el número de destino (formato: whatsapp:+525551234567): ").strip()

if not destino.startswith("whatsapp:"):
    destino = f"whatsapp:{destino}"

mensaje = input("Ingresa el mensaje a enviar: ").strip() or "Hola desde DOMUS+! 🎉"

try:
    message = client.messages.create(
        body=mensaje,
        from_=whatsapp_number,
        to=destino
    )
    
    print(f"\n✅ Mensaje enviado exitosamente!")
    print(f"   Message SID: {message.sid}")
    print(f"   Estado: {message.status}")
    print(f"\n💡 Si estás usando el sandbox de Twilio, asegúrate de que el número")
    print(f"   de destino esté autorizado en la consola de Twilio.")
    
except Exception as e:
    print(f"\n❌ Error al enviar mensaje: {str(e)}")
    print("\nPosibles causas:")
    print("   - El número de destino no está autorizado (sandbox)")
    print("   - Credenciales incorrectas")
    print("   - Número de WhatsApp no válido")
    print("   - Problemas de red")
