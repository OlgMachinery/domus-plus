from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services import receipt_processor
import base64
from datetime import datetime

router = APIRouter()

@router.post("/process")
async def process_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Procesa un recibo subido manualmente desde el dashboard.
    """
    # Leer y codificar la imagen
    image_data = await file.read()
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    
    # Procesar el recibo
    receipt_data = receipt_processor.process_receipt_image(image_base64)
    
    if not receipt_data:
        raise HTTPException(status_code=400, detail="No se pudo procesar el recibo")
    
    # Buscar el presupuesto correspondiente
    family_budget = None
    if current_user.family_id:
        family_budget = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == current_user.family_id,
            models.FamilyBudget.category == receipt_data.category,
            models.FamilyBudget.subcategory == receipt_data.subcategory
        ).first()
    
    # Crear la transacción
    date_str = f"{receipt_data.date} {receipt_data.time}"
    transaction_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
    
    db_transaction = models.Transaction(
        user_id=current_user.id,
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
        status=models.TransactionStatus.PROCESSED
    )
    db.add(db_transaction)
    
    # Actualizar presupuesto si existe
    if family_budget:
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.user_id == current_user.id,
            models.UserBudget.family_budget_id == family_budget.id
        ).first()
        
        if user_budget:
            user_budget.spent_amount += receipt_data.amount
            db.add(user_budget)
    
    db.commit()
    db.refresh(db_transaction)
    
    return {
        "message": "Recibo procesado exitosamente",
        "transaction": schemas.TransactionResponse.model_validate(db_transaction)
    }

