import base64
import json
from typing import Optional
from app.schemas import ReceiptData
from app.models import Category, Subcategory
import os

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None
    client = None

def process_receipt_image(image_base64: str) -> Optional[ReceiptData]:
    """
    Procesa una imagen de recibo usando GPT-4 Vision y extrae los datos estructurados.
    """
    if not OPENAI_AVAILABLE or not client:
        raise ValueError("OpenAI client not available. Install: pip install openai")
    
    try:
        response = client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "system",
                    "content": """You must return ONLY a valid JSON object (no markdown, no extra text). Extract the receipt data.

Output fields (always include all):
date, time, amount, currency, merchant_or_beneficiary, category, subcategory, concept, reference, operation_id, tracking_key, status, notes

Formatting rules:
- date: YYYY-MM-DD
- time: HH:MM (24h). If unknown, use "00:00".
- amount: number only (no currency symbols)
- currency: "MXN" unless clearly another.

Categorization rules (MUST follow exactly):
- category MUST be exactly one of:
  ["Servicios Basicos","Mercado","Vivienda","Transporte","Impuestos","Educacion","Salud","Vida Social"]

- subcategory MUST be exactly one of the allowed subcategories for the chosen category:
  Servicios Basicos: ["Electricidad CFE","Agua Potable","Gas LP","Internet","Entretenimiento","Garrafones Agua","Telcel"]
  Mercado: ["Mercado General"]
  Vivienda: ["Cuotas Olinala","Seguro Vivienda","Mejoras y Remodelaciones"]
  Transporte: ["Gasolina","Mantenimiento coches","Seguros y Derechos","Lavado"]
  Impuestos: ["Predial"]
  Educacion: ["Colegiaturas"]
  Salud: ["Consulta","Medicamentos","Seguro Medico","Prevencion"]
  Vida Social: ["Salidas Personales","Salidas Familiares","Cumpleanos","Aniversarios","Regalos Navidad"]

If uncertain, set:
- category: "Mercado"
- subcategory: "Mercado General"

Notes: include any useful details like liters, unit price, IVA/tax, payment method, RFC, folio, etc."""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the receipt/transfer data from this image and return the JSON object."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"},
            temperature=0
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        
        # Convertir a ReceiptData
        receipt_data = ReceiptData(
            date=data.get("date", ""),
            time=data.get("time", "00:00"),
            amount=float(data.get("amount", 0)),
            currency=data.get("currency", "MXN"),
            merchant_or_beneficiary=data.get("merchant_or_beneficiary"),
            category=Category(data.get("category", "Mercado")),
            subcategory=Subcategory(data.get("subcategory", "Mercado General")),
            concept=data.get("concept"),
            reference=data.get("reference"),
            operation_id=data.get("operation_id"),
            tracking_key=data.get("tracking_key"),
            status=data.get("status", "processed"),
            notes=data.get("notes")
        )
        
        return receipt_data
        
    except Exception as e:
        print(f"Error processing receipt: {str(e)}")
        return None

