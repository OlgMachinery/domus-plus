from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from typing import List, Optional

router = APIRouter()

@router.post("/family", response_model=schemas.FamilyBudgetResponse)
def create_family_budget(budget: schemas.FamilyBudgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verificar que el usuario pertenezca a una familia
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    # Verificar que sea admin
    if not current_user.is_family_admin:
        raise HTTPException(status_code=403, detail="Solo el administrador puede crear presupuestos")
    
    db_budget = models.FamilyBudget(
        family_id=current_user.family_id,
        category=budget.category,
        subcategory=budget.subcategory,
        year=budget.year,
        total_amount=budget.total_amount
    )
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    
    return db_budget

@router.get("/family", response_model=List[schemas.FamilyBudgetResponse])
def get_family_budgets(year: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    query = db.query(models.FamilyBudget).filter(models.FamilyBudget.family_id == current_user.family_id)
    if year:
        query = query.filter(models.FamilyBudget.year == year)
    
    budgets = query.all()
    return budgets

@router.post("/user", response_model=schemas.UserBudgetResponse)
def create_user_budget(budget: schemas.UserBudgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Verificar que el presupuesto familiar exista
    family_budget = db.query(models.FamilyBudget).filter(models.FamilyBudget.id == budget.family_budget_id).first()
    if not family_budget:
        raise HTTPException(status_code=404, detail="Presupuesto familiar no encontrado")
    
    # Verificar que el usuario pertenezca a la misma familia
    if family_budget.family_id != current_user.family_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este presupuesto")
    
    # Verificar que no exceda el total del presupuesto familiar
    existing_allocations = db.query(models.UserBudget).filter(
        models.UserBudget.family_budget_id == budget.family_budget_id
    ).all()
    total_allocated = sum(alloc.allocated_amount for alloc in existing_allocations)
    
    if total_allocated + budget.allocated_amount > family_budget.total_amount:
        raise HTTPException(status_code=400, detail="La asignación excede el presupuesto familiar disponible")
    
    db_budget = models.UserBudget(
        user_id=budget.user_id,
        family_budget_id=budget.family_budget_id,
        allocated_amount=budget.allocated_amount
    )
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    
    return db_budget

@router.get("/user", response_model=List[schemas.UserBudgetResponse])
def get_user_budgets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    budgets = db.query(models.UserBudget).filter(models.UserBudget.user_id == current_user.id).all()
    return budgets
