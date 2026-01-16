from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from app.database import get_db
from app import models, schemas, auth
from app.services import activity_logger
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# Categorías y subcategorías individuales (no compartidas)
INDIVIDUAL_CATEGORIES = {
    "Educacion": ["Colegiaturas", "Gonzalo", "Sebastian", "Emiliano", "Isabela", "Santiago", "Enrique"],
    "Transporte": ["Gasolina", "Mantenimiento coches", "Seguros y Derechos", "Lavado", "LX600", "BMW", "HONDA CIVIC", "LAND CRUISER"],
    "Vida Social": ["Salidas Personales", "Salidas Gonzalo", "Salidas Emiliano", "Salidas Sebastian", "Semana Isabela", "Semana Santiago"],
    "Salud Medicamentos": ["Gonzalo Jr Vuminix, Medikinet", "Isabela Luvox, Risperdal", "Gonzalo MF, Lexapro, Concerta, Efexxor", "Sebastian MB, Concerta", "Emiliano MB, Concerta, Vuminix"]
}

def is_individual_category(category: str, subcategory: str) -> bool:
    """Verifica si una categoría/subcategoría es individual"""
    if category in INDIVIDUAL_CATEGORIES:
        return subcategory in INDIVIDUAL_CATEGORIES[category]
    return False

@router.get("/categories")
def get_individual_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene las categorías y subcategorías disponibles para presupuestos personales.
    """
    categories = []
    for cat, subcats in INDIVIDUAL_CATEGORIES.items():
        categories.append({
            "category": cat,
            "subcategories": subcats
        })
    return {"categories": categories}

@router.post("/", response_model=schemas.FamilyBudgetResponse)
def create_personal_budget(
    budget: schemas.FamilyBudgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Crea un presupuesto personal para el usuario actual.
    Solo permite categorías individuales.
    """
    try:
        # Verificar que el usuario pertenezca a una familia
        if not current_user.family_id:
            raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
        
        # Verificar que la categoría sea individual
        category_str = budget.category.value if isinstance(budget.category, models.Category) else budget.category
        subcategory_str = budget.subcategory.value if isinstance(budget.subcategory, models.Subcategory) else budget.subcategory
        
        if not is_individual_category(category_str, subcategory_str):
            raise HTTPException(
                status_code=400, 
                detail=f"La categoría {category_str} - {subcategory_str} no es una categoría individual. Solo puedes crear presupuestos personales para: Colegiaturas, Gasolina, Reparaciones, Vida Social personal."
            )
        
        # Validar que el monto sea positivo
        if budget.total_amount <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
        if budget.total_amount > 1000000000:
            raise HTTPException(status_code=400, detail="El monto excede el límite permitido")
        
        # Validar año
        current_year = datetime.now().year
        if budget.year < current_year - 1 or budget.year > current_year + 1:
            raise HTTPException(status_code=400, detail="El año debe ser el actual, anterior o siguiente")
        
        # Convertir enum a valor string
        budget_type_value = models.BudgetType.INDIVIDUAL.value
        distribution_method_value = budget.distribution_method.value if isinstance(budget.distribution_method, models.DistributionMethod) else budget.distribution_method
        
        # Crear presupuesto individual para el usuario actual
        db_budget = models.FamilyBudget(
            family_id=current_user.family_id,
            category=budget.category,
            subcategory=budget.subcategory,
            year=budget.year,
            total_amount=budget.total_amount,
            monthly_amounts=budget.monthly_amounts,
            budget_type=budget_type_value,
            distribution_method=distribution_method_value,
            auto_distribute=False,  # No se distribuye automáticamente, es personal
            target_user_id=current_user.id  # Asignado al usuario actual
        )
        db.add(db_budget)
        db.flush()
        
        # Crear UserBudget para el usuario actual
        user_budget = models.UserBudget(
            user_id=current_user.id,
            family_budget_id=db_budget.id,
            allocated_amount=budget.total_amount
        )
        db.add(user_budget)
        
        db.commit()
        db.refresh(db_budget)
        db.refresh(user_budget)
        
        # Calcular income_amount desde transacciones (si existe)
        income_amount = 0.0
        transactions = db.query(models.Transaction).filter(
            models.Transaction.family_budget_id == db_budget.id,
            models.Transaction.user_id == current_user.id,
            models.Transaction.transaction_type == models.TransactionType.INCOME.value
        ).all()
        income_amount = sum(t.amount for t in transactions)
        
        # Calcular available_amount
        available_amount = user_budget.allocated_amount + income_amount - (user_budget.spent_amount or 0.0)
        
        # Crear user_allocation con available_amount calculado
        user_allocation_dict = {
            "id": user_budget.id,
            "user_id": user_budget.user_id,
            "family_budget_id": user_budget.family_budget_id,
            "allocated_amount": user_budget.allocated_amount,
            "spent_amount": user_budget.spent_amount or 0.0,
            "income_amount": income_amount,
            "available_amount": available_amount,
            "created_at": user_budget.created_at
        }
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                user_id=current_user.id,
                action_type="personal_budget_created",
                entity_type="budget",
                entity_id=db_budget.id,
                description=f"Presupuesto personal creado: {category_str} - {subcategory_str}",
                details={
                    "category": category_str,
                    "subcategory": subcategory_str,
                    "year": budget.year,
                    "total_amount": budget.total_amount
                }
            )
        except Exception as log_error:
            print(f"Error al registrar en log: {log_error}")
        
        # Crear respuesta manualmente para asegurar que available_amount esté calculado
        budget_dict = {
            "id": db_budget.id,
            "family_id": db_budget.family_id,
            "category": db_budget.category,
            "subcategory": db_budget.subcategory,
            "year": db_budget.year,
            "total_amount": db_budget.total_amount,
            "monthly_amounts": db_budget.monthly_amounts,
            "budget_type": db_budget.budget_type,
            "distribution_method": db_budget.distribution_method,
            "auto_distribute": db_budget.auto_distribute,
            "target_user_id": db_budget.target_user_id,
            "display_names": db_budget.display_names,
            "due_date": db_budget.due_date,
            "payment_status": db_budget.payment_status,
            "notes": db_budget.notes,
            "created_at": db_budget.created_at,
            "updated_at": db_budget.updated_at,
            "user_allocations": [user_allocation_dict],
            "target_user": None
        }
        
        return schemas.FamilyBudgetResponse.model_validate(budget_dict)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error al crear presupuesto personal: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/", response_model=List[schemas.FamilyBudgetResponse])
def get_personal_budgets(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene todos los presupuestos asignados al usuario actual.
    Incluye:
    - Presupuestos individuales (target_user_id == current_user.id)
    - Presupuestos compartidos donde el usuario tiene un UserBudget asignado
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    # Obtener IDs de presupuestos donde el usuario tiene asignación
    user_budget_ids = db.query(models.UserBudget.family_budget_id).filter(
        models.UserBudget.user_id == current_user.id
    ).subquery()
    
    # Obtener presupuestos individuales O presupuestos compartidos asignados al usuario
    query = db.query(models.FamilyBudget).filter(
        models.FamilyBudget.family_id == current_user.family_id
    ).filter(
        or_(
            # Presupuestos individuales asignados al usuario
            and_(
                models.FamilyBudget.target_user_id == current_user.id,
                models.FamilyBudget.budget_type == models.BudgetType.INDIVIDUAL.value
            ),
            # Presupuestos compartidos donde el usuario tiene UserBudget
            and_(
                models.FamilyBudget.id.in_(user_budget_ids),
                models.FamilyBudget.budget_type == models.BudgetType.SHARED.value
            )
        )
    )
    
    if year:
        query = query.filter(models.FamilyBudget.year == year)
    
    budgets = query.order_by(models.FamilyBudget.category, models.FamilyBudget.subcategory).all()
    
    # Optimización: Obtener todos los UserBudgets y income_amounts en consultas agregadas
    budget_ids = [b.id for b in budgets] if budgets else []
    
    # Obtener todos los UserBudgets del usuario actual en una sola consulta
    user_budgets_dict = {}
    if budget_ids:
        user_budgets = db.query(models.UserBudget).filter(
            models.UserBudget.family_budget_id.in_(budget_ids),
            models.UserBudget.user_id == current_user.id
        ).all()
        user_budgets_dict = {ub.family_budget_id: ub for ub in user_budgets}
    
    # Obtener todos los income_amounts en una sola consulta agregada
    income_totals = {}
    if budget_ids:
        income_results = db.query(
            models.Transaction.family_budget_id,
            func.sum(models.Transaction.amount).label('total_income')
        ).filter(
            models.Transaction.family_budget_id.in_(budget_ids),
            models.Transaction.user_id == current_user.id,
            models.Transaction.transaction_type == models.TransactionType.INCOME.value
        ).group_by(
            models.Transaction.family_budget_id
        ).all()
        
        income_totals = {result.family_budget_id: float(result.total_income) if result.total_income else 0.0 
                        for result in income_results}
    
    # Asignar user_allocations y calcular available_amount
    for budget in budgets:
        user_budget = user_budgets_dict.get(budget.id)
        
        if user_budget:
            # Obtener income_amount del diccionario pre-calculado
            income_amount = income_totals.get(budget.id, 0.0)
            
            # Calcular available_amount
            user_budget.available_amount = user_budget.allocated_amount + income_amount - (user_budget.spent_amount or 0.0)
            user_budget.income_amount = income_amount
            
            # Solo mostrar el UserBudget del usuario actual
            budget.user_allocations = [user_budget]
        else:
            budget.user_allocations = []
    
    return budgets

@router.get("/{budget_id}", response_model=schemas.FamilyBudgetResponse)
def get_personal_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene un presupuesto personal específico.
    """
    budget = db.query(models.FamilyBudget).filter(
        models.FamilyBudget.id == budget_id,
        models.FamilyBudget.target_user_id == current_user.id,
        models.FamilyBudget.budget_type == models.BudgetType.INDIVIDUAL.value
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto personal no encontrado")
    
    # Cargar user_allocations
    budget.user_allocations = db.query(models.UserBudget).filter(
        models.UserBudget.family_budget_id == budget.id
    ).all()
    
    return budget

@router.put("/{budget_id}", response_model=schemas.FamilyBudgetResponse)
def update_personal_budget(
    budget_id: int,
    budget_update: schemas.FamilyBudgetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza un presupuesto personal.
    """
    budget = db.query(models.FamilyBudget).filter(
        models.FamilyBudget.id == budget_id,
        models.FamilyBudget.target_user_id == current_user.id,
        models.FamilyBudget.budget_type == models.BudgetType.INDIVIDUAL.value
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto personal no encontrado")
    
    try:
        # Actualizar campos permitidos
        if budget_update.total_amount is not None:
            if budget_update.total_amount <= 0:
                raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
            budget.total_amount = budget_update.total_amount
            
            # Actualizar UserBudget
            user_budget = db.query(models.UserBudget).filter(
                models.UserBudget.family_budget_id == budget.id,
                models.UserBudget.user_id == current_user.id
            ).first()
            if user_budget:
                user_budget.allocated_amount = budget_update.total_amount
        
        if budget_update.monthly_amounts is not None:
            budget.monthly_amounts = budget_update.monthly_amounts
        
        if budget_update.notes is not None:
            budget.notes = budget_update.notes
        
        if budget_update.due_date is not None:
            budget.due_date = budget_update.due_date
        
        if budget_update.payment_status is not None:
            budget.payment_status = budget_update.payment_status
        
        db.commit()
        db.refresh(budget)
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                user_id=current_user.id,
                action_type="personal_budget_updated",
                entity_type="budget",
                entity_id=budget.id,
                description=f"Presupuesto personal actualizado: {budget.category} - {budget.subcategory}",
                details={"total_amount": budget.total_amount}
            )
        except Exception as log_error:
            print(f"Error al registrar en log: {log_error}")
        
        return schemas.FamilyBudgetResponse.model_validate(budget)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error al actualizar presupuesto personal: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.delete("/{budget_id}")
def delete_personal_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Elimina un presupuesto personal.
    """
    budget = db.query(models.FamilyBudget).filter(
        models.FamilyBudget.id == budget_id,
        models.FamilyBudget.target_user_id == current_user.id,
        models.FamilyBudget.budget_type == models.BudgetType.INDIVIDUAL.value
    ).first()
    
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto personal no encontrado")
    
    try:
        # Eliminar UserBudget asociado
        db.query(models.UserBudget).filter(
            models.UserBudget.family_budget_id == budget.id
        ).delete()
        
        # Eliminar presupuesto
        db.delete(budget)
        db.commit()
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                user_id=current_user.id,
                action_type="personal_budget_deleted",
                entity_type="budget",
                entity_id=budget_id,
                description=f"Presupuesto personal eliminado: {budget.category} - {budget.subcategory}"
            )
        except Exception as log_error:
            print(f"Error al registrar en log: {log_error}")
        
        return {"message": "Presupuesto personal eliminado exitosamente"}
    except Exception as e:
        db.rollback()
        import traceback
        error_detail = f"Error al eliminar presupuesto personal: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)
