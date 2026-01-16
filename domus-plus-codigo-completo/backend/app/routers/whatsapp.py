from fastapi import APIRouter, Request, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
import httpx
import base64
from datetime import datetime

# Imports opcionales para Twilio
try:
    from twilio.twiml.messaging_response import MessagingResponse
    from app.services import whatsapp_service, receipt_processor
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False
    MessagingResponse = None

router = APIRouter()

@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(None),
    MediaUrl0: str = Form(None),
    MessageSid: str = Form(...),
    db: Session = Depends(get_db)
):
    """
    Webhook para recibir mensajes de WhatsApp.
    Procesa imágenes de recibos automáticamente.
    """
    if not TWILIO_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp integration not available. Install: pip install twilio openai"
        )
    
    response = MessagingResponse()
    
    # Extraer número de teléfono (sin el prefijo whatsapp:)
    phone = From.replace("whatsapp:", "")
    
    # Buscar usuario por teléfono
    user = db.query(models.User).filter(models.User.phone == phone).first()
    
    if not user:
        response.message("No estás registrado en DOMUS+. Por favor, regístrate primero.")
        return str(response)
    
    # Si hay una imagen, procesarla
    if MediaUrl0:
        try:
            # Descargar la imagen
            async with httpx.AsyncClient() as client:
                media_response = await client.get(MediaUrl0)
                image_data = media_response.content
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Procesar el recibo
            receipt_data = receipt_processor.process_receipt_image(image_base64)
            
            if receipt_data:
                # Buscar el presupuesto correspondiente
                family_budget = None
                if user.family_id:
                    family_budget = db.query(models.FamilyBudget).filter(
                        models.FamilyBudget.family_id == user.family_id,
                        models.FamilyBudget.category == receipt_data.category,
                        models.FamilyBudget.subcategory == receipt_data.subcategory
                    ).first()
                
                # Crear la transacción
                date_str = f"{receipt_data.date} {receipt_data.time}"
                transaction_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
                
                db_transaction = models.Transaction(
                    user_id=user.id,
                    family_budget_id=family_budget.id if family_budget else None,
                    date=transaction_date,
                    amount=receipt_data.amount,
                    currency=receipt_data.currency,
                    merchant_or_beneficiary=receipt_data.merchant_or_beneficiary,
                    category=receipt_data.category,
                    subcategory=receipt_data.subcategory,
                    concept=receipt_data.concept,
                    reference=receipt_data.reference,
                    operation_id=receipt_data.operation_id,
                    tracking_key=receipt_data.tracking_key,
                    notes=receipt_data.notes,
                    receipt_image_url=MediaUrl0,
                    whatsapp_message_id=MessageSid,
                    status=models.TransactionStatus.PROCESSED
                )
                db.add(db_transaction)
                
                # Actualizar presupuesto si existe
                if family_budget:
                    user_budget = db.query(models.UserBudget).filter(
                        models.UserBudget.user_id == user.id,
                        models.UserBudget.family_budget_id == family_budget.id
                    ).first()
                    
                    if user_budget:
                        user_budget.spent_amount += receipt_data.amount
                        db.add(user_budget)
                
                db.commit()
                
                response.message(f"✅ Recibo procesado exitosamente!\n"
                               f"💰 Monto: ${receipt_data.amount} {receipt_data.currency}\n"
                               f"🏷️ Categoría: {receipt_data.category}\n"
                               f"📝 Concepto: {receipt_data.concept or 'N/A'}")
            else:
                response.message("❌ No pude procesar el recibo. Por favor, intenta con una imagen más clara.")
        
        except Exception as e:
            print(f"Error procesando recibo: {str(e)}")
            response.message("❌ Ocurrió un error al procesar el recibo. Por favor, intenta más tarde.")
    
    elif Body:
        # Procesar comandos de texto
        command = Body.strip().lower()
        
        if command == "saldo" or command == "balance":
            # Obtener presupuestos del usuario
            user_budgets = db.query(models.UserBudget).filter(
                models.UserBudget.user_id == user.id
            ).all()
            
            if user_budgets:
                message = "📊 Tus Presupuestos:\n\n"
                for budget in user_budgets:
                    remaining = budget.allocated_amount - budget.spent_amount
                    message += f"• {budget.family_budget.category} - {budget.family_budget.subcategory}\n"
                    message += f"  Asignado: ${budget.allocated_amount}\n"
                    message += f"  Gastado: ${budget.spent_amount}\n"
                    message += f"  Disponible: ${remaining}\n\n"
                response.message(message)
            else:
                response.message("No tienes presupuestos asignados.")
        else:
            response.message("Envía una foto de tu recibo o transferencia para procesarla automáticamente.\n\n"
                           "Comandos disponibles:\n"
                           "• saldo - Ver tus presupuestos")
    
    return str(response)

