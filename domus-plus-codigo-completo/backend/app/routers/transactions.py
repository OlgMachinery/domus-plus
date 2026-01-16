from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from typing import List, Optional
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=schemas.TransactionResponse)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_transaction = models.Transaction(
        user_id=current_user.id,
        family_budget_id=transaction.family_budget_id,
        date=transaction.date,
        amount=transaction.amount,
        currency=transaction.currency,
        merchant_or_beneficiary=transaction.merchant_or_beneficiary,
        category=transaction.category,
        subcategory=transaction.subcategory,
        concept=transaction.concept,
        reference=transaction.reference,
        operation_id=transaction.operation_id,
        tracking_key=transaction.tracking_key,
        notes=transaction.notes,
        status=models.TransactionStatus.PROCESSED
    )
    db.add(db_transaction)
    
    # Actualizar el presupuesto del usuario si hay family_budget_id
    if transaction.family_budget_id:
        user_budget = db.query(models.UserBudget).filter(
            models.UserBudget.user_id == current_user.id,
            models.UserBudget.family_budget_id == transaction.family_budget_id
        ).first()
        
        if user_budget:
            user_budget.spent_amount += transaction.amount
            db.add(user_budget)
    
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

@router.get("/", response_model=List[schemas.TransactionResponse])
def get_transactions(
    category: Optional[models.Category] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    
    if category:
        query = query.filter(models.Transaction.category == category)
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)
    
    transactions = query.order_by(models.Transaction.date.desc()).all()
    return transactions

@router.get("/{transaction_id}", response_model=schemas.TransactionResponse)
def get_transaction(transaction_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    
    return transaction
