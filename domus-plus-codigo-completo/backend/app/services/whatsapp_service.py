import os
from typing import Optional

try:
    from twilio.rest import Client
    from twilio.twiml.messaging_response import MessagingResponse
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    Client = None
    MessagingResponse = None

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
whatsapp_number = os.getenv("TWILIO_WHATSAPP_NUMBER")

client = Client(account_sid, auth_token) if (TWILIO_AVAILABLE and account_sid and auth_token) else None

def send_whatsapp_message(to: str, message: str) -> bool:
    """
    Envía un mensaje de WhatsApp usando Twilio.
    """
    if not client:
        print("Twilio no configurado")
        return False
    
    try:
        message = client.messages.create(
            body=message,
            from_=whatsapp_number,
            to=f"whatsapp:{to}"
        )
        return True
    except Exception as e:
        print(f"Error enviando mensaje WhatsApp: {str(e)}")
        return False

def process_incoming_message(phone: str, message_body: str, media_url: Optional[str] = None) -> dict:
    """
    Procesa un mensaje entrante de WhatsApp.
    Retorna información sobre el tipo de mensaje.
    """
    return {
        "phone": phone,
        "message_body": message_body,
        "has_media": media_url is not None,
        "media_url": media_url
    }

