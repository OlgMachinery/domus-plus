from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app import models, schemas, auth
from app.services import activity_logger
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import joinedload

router = APIRouter()

@router.post("/family", response_model=schemas.FamilyBudgetResponse)
def create_family_budget(budget: schemas.FamilyBudgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        # Verificar que el usuario pertenezca a una familia
        if not current_user.family_id:
            raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
        
        # Verificar que sea admin
        if not current_user.is_family_admin:
            raise HTTPException(status_code=403, detail="Solo el administrador puede crear presupuestos")
        
        # Validar que el monto sea positivo y razonable
        if budget.total_amount <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
        if budget.total_amount > 1000000000:  # Límite de 1 billón
            raise HTTPException(status_code=400, detail="El monto excede el límite permitido")
        
        # Validar año razonable
        current_year = datetime.now().year
        if budget.year < current_year - 1 or budget.year > current_year + 1:
            raise HTTPException(status_code=400, detail="El año debe ser el actual, anterior o siguiente")
        
        # Convertir enum a valor string si es necesario
        budget_type_value = budget.budget_type.value if isinstance(budget.budget_type, models.BudgetType) else budget.budget_type
        distribution_method_value = budget.distribution_method.value if isinstance(budget.distribution_method, models.DistributionMethod) else budget.distribution_method
        
        # Validar target_user_id para presupuestos individuales
        target_user = None
        if budget_type_value == models.BudgetType.INDIVIDUAL.value:
            if not budget.target_user_id:
                raise HTTPException(status_code=400, detail="Para presupuestos individuales, debes especificar target_user_id")
            target_user = db.query(models.User).filter(models.User.id == budget.target_user_id).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="Usuario objetivo no encontrado")
            if target_user.family_id != current_user.family_id:
                raise HTTPException(status_code=403, detail="El usuario objetivo debe pertenecer a la misma familia")
        
        # Validar categoría personalizada si se proporciona
        if budget.custom_category_id:
            custom_category = db.query(models.CustomCategory).filter(
                models.CustomCategory.id == budget.custom_category_id,
                models.CustomCategory.family_id == current_user.family_id
            ).first()
            if not custom_category:
                raise HTTPException(status_code=404, detail="Categoría personalizada no encontrada")
            
            if budget.custom_subcategory_id:
                custom_subcategory = db.query(models.CustomSubcategory).filter(
                    models.CustomSubcategory.id == budget.custom_subcategory_id,
                    models.CustomSubcategory.custom_category_id == budget.custom_category_id
                ).first()
                if not custom_subcategory:
                    raise HTTPException(status_code=404, detail="Subcategoría personalizada no encontrada")
        
        db_budget = models.FamilyBudget(
            family_id=current_user.family_id,
            category=budget.category,
            subcategory=budget.subcategory,
            custom_category_id=budget.custom_category_id,
            custom_subcategory_id=budget.custom_subcategory_id,
            year=budget.year,
            total_amount=budget.total_amount,
            monthly_amounts=budget.monthly_amounts,  # Guardar montos mensuales si se proporcionan
            budget_type=budget_type_value,
            distribution_method=distribution_method_value,
            auto_distribute=budget.auto_distribute,
            target_user_id=budget.target_user_id
        )
        db.add(db_budget)
        db.flush()  # Para obtener el ID sin hacer commit
        
        # Distribución automática si está habilitada
        if budget.auto_distribute and budget_type_value == models.BudgetType.SHARED.value:
            # Obtener todos los miembros de la familia
            family_members = db.query(models.User).filter(
                models.User.family_id == current_user.family_id
            ).all()
            
            if not family_members:
                raise HTTPException(status_code=400, detail="No hay miembros en la familia para distribuir el presupuesto")
            
            # Distribuir según el método seleccionado
            if distribution_method_value == models.DistributionMethod.EQUAL.value:
                amount_per_user = budget.total_amount / len(family_members)
                for member in family_members:
                    user_budget = models.UserBudget(
                        user_id=member.id,
                        family_budget_id=db_budget.id,
                        allocated_amount=round(amount_per_user, 2)
                    )
                    db.add(user_budget)
            # Para otros métodos (percentage, income_based) se requiere configuración adicional
        
        # Para presupuestos individuales, asignar directamente al usuario objetivo
        elif budget_type_value == models.BudgetType.INDIVIDUAL.value and target_user:
            user_budget = models.UserBudget(
                user_id=target_user.id,
                family_budget_id=db_budget.id,
                allocated_amount=budget.total_amount
            )
            db.add(user_budget)
        
        db.commit()
        db.refresh(db_budget)
        
        # Registrar en log
        try:
            # Determinar nombres de categoría y subcategoría para el log
            if budget.custom_category_id:
                custom_cat = db.query(models.CustomCategory).filter(models.CustomCategory.id == budget.custom_category_id).first()
                custom_subcat = db.query(models.CustomSubcategory).filter(models.CustomSubcategory.id == budget.custom_subcategory_id).first() if budget.custom_subcategory_id else None
                category_name = custom_cat.name if custom_cat else "Categoría personalizada"
                subcategory_name = custom_subcat.name if custom_subcat else "Subcategoría personalizada"
            else:
                category_name = budget.category.value if budget.category else "N/A"
                subcategory_name = budget.subcategory.value if budget.subcategory else "N/A"
            
            activity_logger.log_activity(
                db=db,
                action_type="budget_created",
                entity_type="budget",
                description=f"Presupuesto creado: {category_name} - {subcategory_name} (${budget.total_amount:,.2f})",
                user_id=current_user.id,
                entity_id=db_budget.id,
                details={
                    "category": category_name,
                    "subcategory": subcategory_name,
                    "year": budget.year,
                    "total_amount": budget.total_amount,
                    "budget_type": budget_type_value,
                    "distribution_method": distribution_method_value,
                    "is_custom": budget.custom_category_id is not None
                }
            )
        except Exception as log_error:
            print(f"Error al registrar log: {log_error}")
        
        # Cargar relaciones para la respuesta
        if db_budget.custom_category_id:
            db_budget.custom_category = db.query(models.CustomCategory).filter(models.CustomCategory.id == db_budget.custom_category_id).first()
        if db_budget.custom_subcategory_id:
            db_budget.custom_subcategory = db.query(models.CustomSubcategory).filter(models.CustomSubcategory.id == db_budget.custom_subcategory_id).first()
        
        return db_budget
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al crear presupuesto familiar: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear presupuesto familiar: {str(e)}")

@router.get("/family", response_model=List[schemas.FamilyBudgetResponse])
def get_family_budgets(year: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    try:
        query = db.query(models.FamilyBudget).options(
            joinedload(models.FamilyBudget.user_allocations).joinedload(models.UserBudget.user),
            joinedload(models.FamilyBudget.target_user)
        ).filter(models.FamilyBudget.family_id == current_user.family_id)
        if year:
            query = query.filter(models.FamilyBudget.year == year)
        
        budgets = query.all()
        
        # Optimización: Obtener todos los income_amounts en una sola consulta agregada
        if budgets:
            budget_ids = [b.id for b in budgets]
            user_budget_ids = []
            for budget in budgets:
                if budget.user_allocations:
                    for user_budget in budget.user_allocations:
                        user_budget_ids.append((budget.id, user_budget.user_id))
            
            # Consulta agregada única para todos los income_amounts
            income_totals = {}
            if user_budget_ids:
                # Crear una consulta que agrupe por family_budget_id y user_id
                income_results = db.query(
                    models.Transaction.family_budget_id,
                    models.Transaction.user_id,
                    func.sum(models.Transaction.amount).label('total_income')
                ).filter(
                    models.Transaction.family_budget_id.in_(budget_ids),
                    models.Transaction.transaction_type == models.TransactionType.INCOME.value
                ).group_by(
                    models.Transaction.family_budget_id,
                    models.Transaction.user_id
                ).all()
                
                # Crear diccionario para acceso rápido: (budget_id, user_id) -> total_income
                for result in income_results:
                    key = (result.family_budget_id, result.user_id)
                    income_totals[key] = float(result.total_income) if result.total_income else 0.0
        
        # Calcular available_amount para cada UserBudget usando los datos pre-calculados
        for budget in budgets:
            if budget.user_allocations:
                for user_budget in budget.user_allocations:
                    # Obtener income_amount del diccionario pre-calculado
                    key = (budget.id, user_budget.user_id)
                    income_amount = income_totals.get(key, 0.0)
                    
                    # Calcular available_amount
                    user_budget.available_amount = user_budget.allocated_amount + income_amount - (user_budget.spent_amount or 0.0)
                    user_budget.income_amount = income_amount
        
        return budgets
    except Exception as e:
        import traceback
        error_detail = f"Error al obtener presupuestos: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.post("/user", response_model=schemas.UserBudgetResponse)
def create_user_budget(budget: schemas.UserBudgetCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        # Verificar que el presupuesto familiar exista
        family_budget = db.query(models.FamilyBudget).filter(models.FamilyBudget.id == budget.family_budget_id).first()
        if not family_budget:
            raise HTTPException(status_code=404, detail="Presupuesto familiar no encontrado")
        
        # Verificar que el usuario pertenezca a la misma familia
        if family_budget.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este presupuesto")
        
        # Verificar que el user_id pertenezca a la misma familia
        target_user = db.query(models.User).filter(models.User.id == budget.user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if target_user.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="El usuario debe pertenecer a la misma familia")
        
        # Validar que el monto sea positivo y razonable
        if budget.allocated_amount <= 0:
            raise HTTPException(status_code=400, detail="El monto asignado debe ser mayor a cero")
        if budget.allocated_amount > 1000000000:  # Límite de 1 billón
            raise HTTPException(status_code=400, detail="El monto asignado excede el límite permitido")
        
        # Verificar que no exceda el total del presupuesto familiar
        existing_allocations = db.query(models.UserBudget).filter(
            models.UserBudget.family_budget_id == budget.family_budget_id
        ).all()
        total_allocated = sum(alloc.allocated_amount for alloc in existing_allocations)
        
        if total_allocated + budget.allocated_amount > family_budget.total_amount:
            available = family_budget.total_amount - total_allocated
            raise HTTPException(
                status_code=400, 
                detail=f"La asignación excede el presupuesto familiar disponible. Disponible: ${available:,.2f}"
            )
        
        db_budget = models.UserBudget(
            user_id=budget.user_id,
            family_budget_id=budget.family_budget_id,
            allocated_amount=budget.allocated_amount
        )
        db.add(db_budget)
        db.commit()
        db.refresh(db_budget)
        
        return db_budget
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al crear presupuesto de usuario: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear presupuesto de usuario: {str(e)}")

@router.get("/user", response_model=List[schemas.UserBudgetResponse])
def get_user_budgets(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    budgets = db.query(models.UserBudget).options(
        joinedload(models.UserBudget.family_budget),
        joinedload(models.UserBudget.user)
    ).filter(models.UserBudget.user_id == current_user.id).all()
    
    # Asegurar que las relaciones estén cargadas
    for budget in budgets:
        if budget.family_budget:
            _ = budget.family_budget.category  # Forzar carga
        if budget.user:
            _ = budget.user.name  # Forzar carga
    
    return budgets

@router.post("/family/{budget_id}/distribute")
def distribute_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Distribuye un presupuesto familiar entre todos los miembros de la familia.
    Solo funciona para presupuestos compartidos (SHARED).
    """
    try:
        # Verificar que el presupuesto exista
        family_budget = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.id == budget_id
        ).first()
        
        if not family_budget:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
        # Verificar permisos
        if family_budget.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este presupuesto")
        
        if not current_user.is_family_admin:
            raise HTTPException(status_code=403, detail="Solo el administrador puede distribuir presupuestos")
        
        if family_budget.budget_type != models.BudgetType.SHARED.value:
            raise HTTPException(status_code=400, detail="Solo se pueden distribuir presupuestos compartidos")
        
        # Obtener miembros de la familia
        family_members = db.query(models.User).filter(
            models.User.family_id == current_user.family_id
        ).all()
        
        if not family_members:
            raise HTTPException(status_code=400, detail="No hay miembros en la familia")
        
        # Eliminar asignaciones existentes
        existing_allocations = db.query(models.UserBudget).filter(
            models.UserBudget.family_budget_id == budget_id
        ).all()
        
        for allocation in existing_allocations:
            db.delete(allocation)
        
        # Distribuir según el método
        if family_budget.distribution_method == models.DistributionMethod.EQUAL.value:
            amount_per_user = family_budget.total_amount / len(family_members)
            for member in family_members:
                user_budget = models.UserBudget(
                    user_id=member.id,
                    family_budget_id=budget_id,
                    allocated_amount=round(amount_per_user, 2)
                )
                db.add(user_budget)
        
        db.commit()
        
        return {
            "message": f"Presupuesto distribuido entre {len(family_members)} miembros",
            "amount_per_user": round(family_budget.total_amount / len(family_members), 2) if family_members else 0
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al distribuir presupuesto: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al distribuir presupuesto: {str(e)}")

@router.put("/family/{budget_id}", response_model=schemas.FamilyBudgetResponse)
def update_family_budget(
    budget_id: int,
    budget: schemas.FamilyBudgetCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza un presupuesto familiar existente.
    Solo el administrador puede actualizar presupuestos.
    """
    try:
        # Verificar que el usuario sea admin
        if not current_user.is_family_admin:
            raise HTTPException(status_code=403, detail="Solo el administrador puede actualizar presupuestos")
        
        # Buscar el presupuesto existente
        db_budget = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.id == budget_id
        ).first()
        
        if not db_budget:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
        # Verificar permisos
        if db_budget.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este presupuesto")
        
        # Validar que el monto sea positivo y razonable
        if budget.total_amount <= 0:
            raise HTTPException(status_code=400, detail="El monto debe ser mayor a cero")
        if budget.total_amount > 1000000000:
            raise HTTPException(status_code=400, detail="El monto excede el límite permitido")
        
        # Validar año razonable
        current_year = datetime.now().year
        if budget.year < current_year - 1 or budget.year > current_year + 1:
            raise HTTPException(status_code=400, detail="El año debe ser el actual, anterior o siguiente")
        
        # Convertir enum a valor string si es necesario
        budget_type_value = budget.budget_type.value if isinstance(budget.budget_type, models.BudgetType) else budget.budget_type
        distribution_method_value = budget.distribution_method.value if isinstance(budget.distribution_method, models.DistributionMethod) else budget.distribution_method
        
        # Validar target_user_id para presupuestos individuales
        target_user = None
        if budget_type_value == models.BudgetType.INDIVIDUAL.value:
            if not budget.target_user_id:
                raise HTTPException(status_code=400, detail="Para presupuestos individuales, debes especificar target_user_id")
            target_user = db.query(models.User).filter(models.User.id == budget.target_user_id).first()
            if not target_user:
                raise HTTPException(status_code=404, detail="Usuario objetivo no encontrado")
            if target_user.family_id != current_user.family_id:
                raise HTTPException(status_code=403, detail="El usuario objetivo debe pertenecer a la misma familia")
        
        # Actualizar campos del presupuesto
        db_budget.category = budget.category
        db_budget.subcategory = budget.subcategory
        db_budget.year = budget.year
        db_budget.total_amount = budget.total_amount
        db_budget.monthly_amounts = budget.monthly_amounts
        db_budget.budget_type = budget_type_value
        db_budget.distribution_method = distribution_method_value
        db_budget.auto_distribute = budget.auto_distribute
        db_budget.target_user_id = budget.target_user_id
        
        db.commit()
        db.refresh(db_budget)
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                action_type="budget_updated",
                entity_type="budget",
                description=f"Presupuesto actualizado: {budget.category.value} - {budget.subcategory.value} (${budget.total_amount:,.2f})",
                user_id=current_user.id,
                entity_id=db_budget.id,
                details={
                    "category": budget.category.value,
                    "subcategory": budget.subcategory.value,
                    "year": budget.year,
                    "total_amount": budget.total_amount,
                    "budget_type": budget_type_value
                }
            )
        except Exception as log_error:
            print(f"Error al registrar log: {log_error}")
        
        return db_budget
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar presupuesto: {str(e)}")

@router.get("/global-summary")
def get_global_budget_summary(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Devuelve un resumen del presupuesto global que incluye:
    - Presupuestos compartidos (SHARED)
    - Presupuestos individuales (INDIVIDUAL) agrupados por categoría/subcategoría
    - Total global por categoría/subcategoría
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    try:
        # Año por defecto: año actual
        if not year:
            year = datetime.now().year
        
        # Obtener todos los presupuestos del año
        budgets = db.query(models.FamilyBudget).options(
            joinedload(models.FamilyBudget.user_allocations),
            joinedload(models.FamilyBudget.target_user)
        ).filter(
            models.FamilyBudget.family_id == current_user.family_id,
            models.FamilyBudget.year == year
        ).all()
        
        # Agrupar por categoría y subcategoría
        summary = {}
        
        for budget in budgets:
            key = f"{budget.category.value}|{budget.subcategory.value}"
            
            if key not in summary:
                summary[key] = {
                    'category': budget.category.value,
                    'subcategory': budget.subcategory.value,
                    'shared_amount': 0.0,
                    'individual_amounts': {},  # {user_id: amount, user_name: name}
                    'total_amount': 0.0
                }
            
            if budget.budget_type == models.BudgetType.SHARED.value:
                summary[key]['shared_amount'] += budget.total_amount
            elif budget.budget_type == models.BudgetType.INDIVIDUAL.value:
                if budget.target_user:
                    user_id = budget.target_user.id
                    user_name = budget.target_user.name
                    if user_id not in summary[key]['individual_amounts']:
                        summary[key]['individual_amounts'][user_id] = {
                            'amount': 0.0,
                            'name': user_name
                        }
                    summary[key]['individual_amounts'][user_id]['amount'] += budget.total_amount
            
            summary[key]['total_amount'] += budget.total_amount
        
        # Convertir a lista y calcular totales
        summary_list = []
        total_shared = 0.0
        total_individual = 0.0
        total_global = 0.0
        
        for key, data in summary.items():
            individual_total = sum(user_data['amount'] for user_data in data['individual_amounts'].values())
            total_shared += data['shared_amount']
            total_individual += individual_total
            total_global += data['total_amount']
            
            summary_list.append({
                **data,
                'individual_total': individual_total
            })
        
        return {
            'year': year,
            'summary': summary_list,
            'totals': {
                'shared': round(total_shared, 2),
                'individual': round(total_individual, 2),
                'global': round(total_global, 2)
            }
        }
    except Exception as e:
        import traceback
        error_detail = f"Error al obtener resumen global: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/annual-matrix")
def get_annual_budget_matrix(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Devuelve el presupuesto anual en formato de matriz (tabla pivot).
    Cada fila es un concepto (categoría-subcategoría) y cada columna es un mes + total anual.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    try:
        # Año por defecto: año actual
        if not year:
            year = datetime.now().year
        
        # Obtener todos los presupuestos del año
        budgets = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == current_user.family_id,
            models.FamilyBudget.year == year
        ).order_by(
            models.FamilyBudget.category,
            models.FamilyBudget.subcategory
        ).all()
        
        # Meses en español
        meses_es = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]
        
        # Mapeo de meses en inglés (del Excel) a español
        meses_en = [
            'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
            'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
        ]
        mes_mapping = dict(zip(meses_en, meses_es))
        
        # Construir la matriz
        matrix = []
        total_anual = 0.0
        totales_mensuales = {mes: 0.0 for mes in meses_es}
        
        for budget in budgets:
            # Construir fila de la matriz
            row = {
                'concepto': f"{budget.category.value} - {budget.subcategory.value}",
                'categoria': budget.category.value,
                'subcategoria': budget.subcategory.value,
                'meses': {}
            }
            
            # Usar montos mensuales reales si están disponibles, sino dividir el total entre 12
            monthly_amounts_dict = None
            if budget.monthly_amounts:
                # SQLite puede guardar JSON como string, necesitamos parsearlo
                if isinstance(budget.monthly_amounts, str):
                    import json
                    try:
                        monthly_amounts_dict = json.loads(budget.monthly_amounts)
                    except:
                        monthly_amounts_dict = None
                elif isinstance(budget.monthly_amounts, dict):
                    monthly_amounts_dict = budget.monthly_amounts
            
            if monthly_amounts_dict and len(monthly_amounts_dict) > 0:
                # Hay montos mensuales reales del Excel
                for mes_en, monto in monthly_amounts_dict.items():
                    mes_es = mes_mapping.get(mes_en.upper(), None)
                    if mes_es:
                        row['meses'][mes_es] = round(float(monto), 2)
                        totales_mensuales[mes_es] += float(monto)
                # Rellenar meses faltantes con 0
                for mes_es in meses_es:
                    if mes_es not in row['meses']:
                        row['meses'][mes_es] = 0.0
            else:
                # No hay montos mensuales o solo hay un mes, dividir el total entre 12
                monto_mensual = budget.total_amount / 12.0
                for mes_es in meses_es:
                    row['meses'][mes_es] = round(monto_mensual, 2)
                    totales_mensuales[mes_es] += monto_mensual
            
            # Total anual para este concepto
            row['total_anual'] = round(budget.total_amount, 2)
            total_anual += budget.total_amount
            
            matrix.append(row)
        
        # Agregar fila de totales
        totales_row = {
            'concepto': 'TOTAL',
            'categoria': '',
            'subcategoria': '',
            'meses': {mes: round(totales_mensuales[mes], 2) for mes in meses_es},
            'total_anual': round(total_anual, 2)
        }
        matrix.append(totales_row)
        
        return {
            'year': year,
            'meses': meses_es,
            'matrix': matrix,
            'total_conceptos': len(budgets)
        }
    except Exception as e:
        import traceback
        error_detail = f"Error al obtener matriz de presupuesto: {str(e)}"
        print(error_detail)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_detail)

@router.get("/summary")
def get_budget_summary(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene un concentrado completo del presupuesto anual con todas las cuentas.
    Incluye información de contribuyentes, movimientos, pagos y vencimientos.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    try:
        if not year:
            year = datetime.now().year
        
        # Obtener todos los presupuestos del año
        budgets = db.query(models.FamilyBudget).options(
            joinedload(models.FamilyBudget.user_allocations).joinedload(models.UserBudget.user),
            joinedload(models.FamilyBudget.target_user)
        ).filter(
            models.FamilyBudget.family_id == current_user.family_id,
            models.FamilyBudget.year == year
        ).all()
        
        accounts = []
        for budget in budgets:
            # Obtener contribuyentes
            contributors = []
            total_allocated = 0
            for allocation in budget.user_allocations or []:
                total_allocated += allocation.allocated_amount
                if allocation.user:
                    percentage = (allocation.allocated_amount / budget.total_amount * 100) if budget.total_amount > 0 else 0
                    contributors.append({
                        'user_id': allocation.user.id,
                        'user_name': allocation.user.name,
                        'allocated_amount': allocation.allocated_amount,
                        'percentage': percentage
                    })
            
            # Obtener transacciones relacionadas (movimientos)
            transactions = db.query(models.Transaction).filter(
                models.Transaction.family_budget_id == budget.id
            ).all()
            
            # Calcular montos pagados y restantes
            total_paid = 0.0
            total_income = 0.0
            movements = []
            for transaction in transactions:
                if transaction.transaction_type == models.TransactionType.EXPENSE.value:
                    total_paid += transaction.amount
                elif transaction.transaction_type == models.TransactionType.INCOME.value:
                    total_income += transaction.amount
                
                movements.append({
                    'id': transaction.id,
                    'date': transaction.date.isoformat() if transaction.date else None,
                    'amount': transaction.amount,
                    'type': transaction.transaction_type,
                    'merchant_or_beneficiary': transaction.merchant_or_beneficiary,
                    'concept': transaction.concept,
                    'status': transaction.status.value if transaction.status else None
                })
            
            # Calcular monto restante
            remaining_amount = budget.total_amount - total_paid + total_income
            if remaining_amount < 0:
                remaining_amount = 0
            
            # Calcular monto mensual (promedio)
            monthly_amount = budget.total_amount / 12.0
            
            # Obtener nombres de visualización personalizados
            display_names = budget.display_names if budget.display_names else {}
            if isinstance(display_names, str):
                import json
                try:
                    display_names = json.loads(display_names)
                except:
                    display_names = {}
            
            category_display_name = display_names.get('category') if display_names else None
            subcategory_display_name = display_names.get('subcategory') if display_names else None
            
            # Determinar estado de pago si no está definido
            payment_status = budget.payment_status
            if not payment_status:
                if total_paid >= budget.total_amount:
                    payment_status = "paid"
                elif total_paid > 0:
                    payment_status = "partial"
                else:
                    payment_status = "pending"
            
            # Verificar si está vencido
            is_overdue = False
            if budget.due_date:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc)
                if isinstance(budget.due_date, datetime):
                    due_date_utc = budget.due_date
                    if due_date_utc.tzinfo is None:
                        due_date_utc = due_date_utc.replace(tzinfo=timezone.utc)
                    if due_date_utc < now and payment_status != "paid":
                        is_overdue = True
                        payment_status = "overdue"
            
            accounts.append({
                'id': budget.id,
                'category': budget.category.value,
                'subcategory': budget.subcategory.value,
                'category_display_name': category_display_name,
                'subcategory_display_name': subcategory_display_name,
                'total_amount': budget.total_amount,
                'monthly_amount': monthly_amount,
                'paid_amount': total_paid,
                'remaining_amount': remaining_amount,
                'income_amount': total_income,
                'movements_count': len(movements),
                'movements': movements,
                'due_date': budget.due_date.isoformat() if budget.due_date else None,
                'payment_status': payment_status,
                'is_overdue': is_overdue,
                'budget_type': budget.budget_type,
                'distribution_method': budget.distribution_method,
                'contributors_count': len(contributors),
                'contributors': contributors,
                'notes': budget.notes,
                'year': budget.year
            })
        
        # Ordenar alfabéticamente por categoría y subcategoría
        accounts.sort(key=lambda x: (
            (x['category_display_name'] or x['category']).lower(),
            (x['subcategory_display_name'] or x['subcategory']).lower()
        ))
        
        return accounts
    except Exception as e:
        import traceback
        print(f"Error en get_budget_summary: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error al obtener concentrado: {str(e)}")

@router.put("/account/{account_id}/display-names")
def update_account_display_names(
    account_id: int,
    display_names: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza los nombres de visualización personalizados para una cuenta (categoría/subcategoría).
    Solo los administradores pueden modificar nombres.
    """
    if not current_user.is_family_admin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden modificar nombres de cuentas")
    
    try:
        # Buscar el presupuesto
        budget = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.id == account_id
        ).first()
        
        if not budget:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
        # Verificar permisos
        if budget.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta cuenta")
        
        # Actualizar nombres de visualización
        current_display_names = budget.display_names if budget.display_names else {}
        if isinstance(current_display_names, str):
            import json
            try:
                current_display_names = json.loads(current_display_names)
            except:
                current_display_names = {}
        
        # Actualizar solo los campos proporcionados
        if 'category_display_name' in display_names:
            if not current_display_names:
                current_display_names = {}
            if display_names['category_display_name']:
                current_display_names['category'] = display_names['category_display_name']
            elif 'category' in current_display_names:
                del current_display_names['category']
        
        if 'subcategory_display_name' in display_names:
            if not current_display_names:
                current_display_names = {}
            if display_names['subcategory_display_name']:
                current_display_names['subcategory'] = display_names['subcategory_display_name']
            elif 'subcategory' in current_display_names:
                del current_display_names['subcategory']
        
        budget.display_names = current_display_names if current_display_names else None
        db.commit()
        db.refresh(budget)
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                action_type="account_display_name_updated",
                entity_type="budget",
                description=f"Nombres de visualización actualizados: {budget.category.value} - {budget.subcategory.value}",
                user_id=current_user.id,
                entity_id=budget.id,
                details={
                    "category": budget.category.value,
                    "subcategory": budget.subcategory.value,
                    "category_display_name": display_names.get('category_display_name'),
                    "subcategory_display_name": display_names.get('subcategory_display_name')
                }
            )
        except Exception as log_error:
            print(f"Error al registrar log: {log_error}")
        
        return {
            "id": budget.id,
            "category": budget.category.value,
            "subcategory": budget.subcategory.value,
            "category_display_name": current_display_names.get('category') if current_display_names else None,
            "subcategory_display_name": current_display_names.get('subcategory') if current_display_names else None
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar nombres: {str(e)}")

@router.put("/account/{account_id}")
def update_budget_account(
    account_id: int,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza campos editables de una cuenta del presupuesto.
    Permite modificar: total_amount, monthly_amounts, due_date, payment_status, notes, display_names
    """
    if not current_user.is_family_admin:
        raise HTTPException(status_code=403, detail="Solo los administradores pueden modificar cuentas")
    
    try:
        budget = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.id == account_id
        ).first()
        
        if not budget:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        
        if budget.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta cuenta")
        
        # Actualizar campos permitidos
        if 'total_amount' in updates:
            budget.total_amount = float(updates['total_amount'])
        
        if 'monthly_amounts' in updates:
            budget.monthly_amounts = updates['monthly_amounts']
        
        if 'due_date' in updates:
            if updates['due_date']:
                from datetime import datetime
                if isinstance(updates['due_date'], str):
                    budget.due_date = datetime.fromisoformat(updates['due_date'].replace('Z', '+00:00'))
                else:
                    budget.due_date = updates['due_date']
            else:
                budget.due_date = None
        
        if 'payment_status' in updates:
            budget.payment_status = updates['payment_status']
        
        if 'notes' in updates:
            budget.notes = updates['notes']
        
        if 'display_names' in updates:
            budget.display_names = updates['display_names']
        
        db.commit()
        db.refresh(budget)
        
        # Registrar en log
        try:
            activity_logger.log_activity(
                db=db,
                action_type="budget_account_updated",
                entity_type="budget",
                description=f"Cuenta actualizada: {budget.category.value} - {budget.subcategory.value}",
                user_id=current_user.id,
                entity_id=budget.id,
                details=updates
            )
        except Exception as log_error:
            print(f"Error al registrar log: {log_error}")
        
        return {
            "id": budget.id,
            "total_amount": budget.total_amount,
            "due_date": budget.due_date.isoformat() if budget.due_date else None,
            "payment_status": budget.payment_status,
            "notes": budget.notes
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar cuenta: {str(e)}")
