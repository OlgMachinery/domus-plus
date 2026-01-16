from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.services import activity_logger
from typing import List, Optional
from datetime import datetime
from sqlalchemy import or_

router = APIRouter()

@router.post("/", response_model=schemas.TransactionResponse)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        # Validar que el monto sea positivo y razonable
        if transaction.amount <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
        if transaction.amount > 1000000000:  # Límite de 1 billón
            raise HTTPException(status_code=400, detail="El monto excede el límite permitido")
        
        # Validar que el family_budget_id pertenezca a la familia del usuario si se proporciona
        if transaction.family_budget_id:
            family_budget = db.query(models.FamilyBudget).filter(
                models.FamilyBudget.id == transaction.family_budget_id
            ).first()
            
            if not family_budget:
                raise HTTPException(status_code=404, detail="Presupuesto familiar no encontrado")
            
            if current_user.family_id != family_budget.family_id:
                raise HTTPException(status_code=403, detail="No tienes acceso a este presupuesto")
        
        db_transaction = models.Transaction(
            user_id=current_user.id,
            family_budget_id=transaction.family_budget_id,
            date=transaction.date,
            amount=transaction.amount,
            transaction_type=transaction.transaction_type.value if isinstance(transaction.transaction_type, models.TransactionType) else transaction.transaction_type,
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
                transaction_type_value = transaction.transaction_type.value if isinstance(transaction.transaction_type, models.TransactionType) else transaction.transaction_type
                if transaction_type_value == models.TransactionType.INCOME.value:
                    # Ingreso: aumenta el income_amount (y por tanto el available_amount)
                    user_budget.income_amount += transaction.amount
                else:
                    # Egreso: aumenta el spent_amount (disminuye el available_amount)
                    user_budget.spent_amount += transaction.amount
                db.add(user_budget)
        
        db.commit()
        db.refresh(db_transaction)
        
        # Registrar en log
        try:
            transaction_type_str = transaction.transaction_type.value if isinstance(transaction.transaction_type, models.TransactionType) else str(transaction.transaction_type)
            activity_logger.log_activity(
                db=db,
                action_type="transaction_created",
                entity_type="transaction",
                description=f"Transacción creada: {transaction_type_str} de ${transaction.amount:,.2f} - {transaction.category.value}",
                user_id=current_user.id,
                entity_id=db_transaction.id,
                details={
                    "transaction_type": transaction_type_str,
                    "amount": transaction.amount,
                    "category": transaction.category.value,
                    "subcategory": transaction.subcategory.value,
                    "merchant_or_beneficiary": transaction.merchant_or_beneficiary,
                    "date": transaction.date.isoformat() if isinstance(transaction.date, datetime) else str(transaction.date)
                }
            )
        except Exception as log_error:
            print(f"Error al registrar log: {log_error}")
        
        return db_transaction
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al crear transacción: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear transacción: {str(e)}")

@router.get("/", response_model=List[schemas.TransactionResponse])
def get_transactions(
    category: Optional[models.Category] = Query(None),
    transaction_type: Optional[models.TransactionType] = Query(None),  # Filtro por tipo
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: Optional[int] = Query(100, ge=1, le=1000),  # Límite de resultados
    offset: Optional[int] = Query(0, ge=0),  # Offset para paginación
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = db.query(models.Transaction).filter(models.Transaction.user_id == current_user.id)
    
    if category:
        query = query.filter(models.Transaction.category == category)
    if transaction_type:
        # Convertir enum a valor si es necesario
        transaction_type_value = transaction_type.value if isinstance(transaction_type, models.TransactionType) else transaction_type
        query = query.filter(models.Transaction.transaction_type == transaction_type_value)
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)
    
    # Aplicar paginación
    transactions = query.order_by(models.Transaction.date.desc()).offset(offset).limit(limit).all()
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

@router.put("/{transaction_id}", response_model=schemas.TransactionResponse)
def update_transaction(
    transaction_id: int,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza una transacción existente.
    Permite modificar: amount, date, concept, user_id (beneficiary), family_budget_id (cuenta)
    """
    try:
        transaction = db.query(models.Transaction).filter(
            models.Transaction.id == transaction_id,
            models.Transaction.user_id == current_user.id
        ).first()
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transacción no encontrada")
        
        # Guardar valores antiguos para actualizar presupuestos
        old_amount = transaction.amount
        old_type = transaction.transaction_type
        old_budget_id = transaction.family_budget_id
        
        # Actualizar campos permitidos
        if 'amount' in updates:
            new_amount = float(updates['amount'])
            if new_amount <= 0:
                raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
            if new_amount > 1000000000:
                raise HTTPException(status_code=400, detail="El monto excede el límite permitido")
            transaction.amount = new_amount
        
        if 'date' in updates:
            if isinstance(updates['date'], str):
                transaction.date = datetime.fromisoformat(updates['date'].replace('Z', '+00:00'))
            else:
                transaction.date = updates['date']
        
        if 'concept' in updates:
            transaction.concept = updates['concept']
        
        if 'user_id' in updates:
            # Validar que el usuario pertenezca a la misma familia
            new_user_id = updates['user_id']
            if new_user_id:
                new_user = db.query(models.User).filter(models.User.id == new_user_id).first()
                if not new_user:
                    raise HTTPException(status_code=404, detail="Usuario no encontrado")
                if new_user.family_id != current_user.family_id:
                    raise HTTPException(status_code=403, detail="El usuario debe pertenecer a tu familia")
            transaction.user_id = new_user_id
        
        if 'family_budget_id' in updates:
            new_budget_id = updates['family_budget_id']
            if new_budget_id:
                budget = db.query(models.FamilyBudget).filter(
                    models.FamilyBudget.id == new_budget_id
                ).first()
                if not budget:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                if budget.family_id != current_user.family_id:
                    raise HTTPException(status_code=403, detail="No tienes acceso a este presupuesto")
            transaction.family_budget_id = new_budget_id
        
        # Revertir cambios en el presupuesto antiguo
        if old_budget_id:
            old_user_budget = db.query(models.UserBudget).filter(
                models.UserBudget.user_id == current_user.id,
                models.UserBudget.family_budget_id == old_budget_id
            ).first()
            
            if old_user_budget:
                if old_type == models.TransactionType.INCOME.value:
                    old_user_budget.income_amount -= old_amount
                else:
                    old_user_budget.spent_amount -= old_amount
                db.add(old_user_budget)
        
        # Aplicar cambios en el presupuesto nuevo (o actualizado)
        new_budget_id = transaction.family_budget_id
        if new_budget_id:
            new_user_budget = db.query(models.UserBudget).filter(
                models.UserBudget.user_id == transaction.user_id,
                models.UserBudget.family_budget_id == new_budget_id
            ).first()
            
            if new_user_budget:
                transaction_type_value = transaction.transaction_type
                if transaction_type_value == models.TransactionType.INCOME.value:
                    new_user_budget.income_amount += transaction.amount
                else:
                    new_user_budget.spent_amount += transaction.amount
                db.add(new_user_budget)
        
        db.commit()
        db.refresh(transaction)
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                action_type="transaction_updated",
                entity_type="transaction",
                description=f"Transacción actualizada: {transaction.transaction_type} de ${transaction.amount:,.2f}",
                user_id=current_user.id,
                entity_id=transaction.id,
                details={
                    "transaction_type": transaction.transaction_type,
                    "amount": transaction.amount,
                    "category": transaction.category.value if hasattr(transaction.category, 'value') else str(transaction.category),
                    "subcategory": transaction.subcategory.value if hasattr(transaction.subcategory, 'value') else str(transaction.subcategory),
                    "date": transaction.date.isoformat() if isinstance(transaction.date, datetime) else str(transaction.date)
                }
            )
        except Exception as log_error:
            print(f"Error al registrar log: {log_error}")
        
        return transaction
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al actualizar transacción: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al actualizar transacción: {str(e)}")
