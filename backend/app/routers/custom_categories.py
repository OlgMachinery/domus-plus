"""
Router para gestionar categorías y subcategorías personalizadas
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from app.database import get_db
from app import models, schemas, auth

router = APIRouter()

@router.post("/", response_model=schemas.CustomCategoryResponse)
def create_custom_category(
    category: schemas.CustomCategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Crea una nueva categoría personalizada con sus subcategorías.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    # Verificar que no exista una categoría con el mismo nombre en la familia
    existing = db.query(models.CustomCategory).filter(
        models.CustomCategory.family_id == current_user.family_id,
        models.CustomCategory.name == category.name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una categoría con el nombre '{category.name}'")
    
    # Crear la categoría
    db_category = models.CustomCategory(
        family_id=current_user.family_id,
        name=category.name,
        description=category.description,
        icon=category.icon,
        color=category.color,
        is_active=True
    )
    db.add(db_category)
    db.flush()
    
    # Crear las subcategorías si se proporcionaron
    if category.subcategories:
        for subcat_data in category.subcategories:
            db_subcategory = models.CustomSubcategory(
                custom_category_id=db_category.id,
                name=subcat_data.name,
                description=subcat_data.description,
                is_active=True
            )
            db.add(db_subcategory)
    
    db.commit()
    db.refresh(db_category)
    
    # Cargar subcategorías
    db_category.subcategories = db.query(models.CustomSubcategory).filter(
        models.CustomSubcategory.custom_category_id == db_category.id
    ).all()
    
    return db_category

@router.get("/", response_model=List[schemas.CustomCategoryResponse])
def get_custom_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene todas las categorías personalizadas de la familia del usuario.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    query = db.query(models.CustomCategory).filter(
        models.CustomCategory.family_id == current_user.family_id
    )
    
    if not include_inactive:
        query = query.filter(models.CustomCategory.is_active == True)
    
    categories = query.order_by(models.CustomCategory.name).all()
    
    # Cargar subcategorías para cada categoría
    for category in categories:
        subcat_query = db.query(models.CustomSubcategory).filter(
            models.CustomSubcategory.custom_category_id == category.id
        )
        if not include_inactive:
            subcat_query = subcat_query.filter(models.CustomSubcategory.is_active == True)
        category.subcategories = subcat_query.order_by(models.CustomSubcategory.name).all()
    
    return categories

@router.get("/{category_id}", response_model=schemas.CustomCategoryResponse)
def get_custom_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Obtiene una categoría personalizada específica.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    category = db.query(models.CustomCategory).filter(
        models.CustomCategory.id == category_id,
        models.CustomCategory.family_id == current_user.family_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Cargar subcategorías
    category.subcategories = db.query(models.CustomSubcategory).filter(
        models.CustomSubcategory.custom_category_id == category.id,
        models.CustomSubcategory.is_active == True
    ).order_by(models.CustomSubcategory.name).all()
    
    return category

@router.put("/{category_id}", response_model=schemas.CustomCategoryResponse)
def update_custom_category(
    category_id: int,
    category_update: schemas.CustomCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza una categoría personalizada.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    category = db.query(models.CustomCategory).filter(
        models.CustomCategory.id == category_id,
        models.CustomCategory.family_id == current_user.family_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar nombre único si se está cambiando
    if category_update.name and category_update.name != category.name:
        existing = db.query(models.CustomCategory).filter(
            models.CustomCategory.family_id == current_user.family_id,
            models.CustomCategory.name == category_update.name,
            models.CustomCategory.id != category_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe una categoría con el nombre '{category_update.name}'")
    
    # Actualizar campos
    if category_update.name:
        category.name = category_update.name
    if category_update.description is not None:
        category.description = category_update.description
    if category_update.icon is not None:
        category.icon = category_update.icon
    if category_update.color is not None:
        category.color = category_update.color
    if category_update.is_active is not None:
        category.is_active = category_update.is_active
    
    db.commit()
    db.refresh(category)
    
    # Cargar subcategorías
    category.subcategories = db.query(models.CustomSubcategory).filter(
        models.CustomSubcategory.custom_category_id == category.id,
        models.CustomSubcategory.is_active == True
    ).order_by(models.CustomSubcategory.name).all()
    
    return category

@router.delete("/{category_id}")
def delete_custom_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Elimina (desactiva) una categoría personalizada.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    category = db.query(models.CustomCategory).filter(
        models.CustomCategory.id == category_id,
        models.CustomCategory.family_id == current_user.family_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar si hay presupuestos o transacciones usando esta categoría
    budgets_count = db.query(models.FamilyBudget).filter(
        models.FamilyBudget.custom_category_id == category_id
    ).count()
    
    transactions_count = db.query(models.Transaction).filter(
        models.Transaction.custom_category_id == category_id
    ).count()
    
    if budgets_count > 0 or transactions_count > 0:
        # Solo desactivar en lugar de eliminar
        category.is_active = False
        # También desactivar subcategorías
        db.query(models.CustomSubcategory).filter(
            models.CustomSubcategory.custom_category_id == category_id
        ).update({"is_active": False})
        db.commit()
        return {"message": "Categoría desactivada (tiene presupuestos o transacciones asociadas)"}
    else:
        # Eliminar completamente si no hay referencias
        db.delete(category)
        db.commit()
        return {"message": "Categoría eliminada exitosamente"}

@router.post("/{category_id}/subcategories", response_model=schemas.CustomSubcategoryResponse)
def create_subcategory(
    category_id: int,
    subcategory: schemas.CustomSubcategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Crea una nueva subcategoría para una categoría personalizada.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    # Verificar que la categoría pertenezca a la familia del usuario
    category = db.query(models.CustomCategory).filter(
        models.CustomCategory.id == category_id,
        models.CustomCategory.family_id == current_user.family_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    
    # Verificar que no exista una subcategoría con el mismo nombre
    existing = db.query(models.CustomSubcategory).filter(
        models.CustomSubcategory.custom_category_id == category_id,
        models.CustomSubcategory.name == subcategory.name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una subcategoría con el nombre '{subcategory.name}'")
    
    # Crear la subcategoría
    db_subcategory = models.CustomSubcategory(
        custom_category_id=category_id,
        name=subcategory.name,
        description=subcategory.description,
        is_active=True
    )
    db.add(db_subcategory)
    db.commit()
    db.refresh(db_subcategory)
    
    return db_subcategory

@router.put("/subcategories/{subcategory_id}", response_model=schemas.CustomSubcategoryResponse)
def update_subcategory(
    subcategory_id: int,
    subcategory_update: schemas.CustomSubcategoryBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Actualiza una subcategoría personalizada.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    subcategory = db.query(models.CustomSubcategory).join(
        models.CustomCategory
    ).filter(
        models.CustomSubcategory.id == subcategory_id,
        models.CustomCategory.family_id == current_user.family_id
    ).first()
    
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategoría no encontrada")
    
    # Verificar nombre único si se está cambiando
    if subcategory_update.name and subcategory_update.name != subcategory.name:
        existing = db.query(models.CustomSubcategory).filter(
            models.CustomSubcategory.custom_category_id == subcategory.custom_category_id,
            models.CustomSubcategory.name == subcategory_update.name,
            models.CustomSubcategory.id != subcategory_id
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail=f"Ya existe una subcategoría con el nombre '{subcategory_update.name}'")
    
    # Actualizar campos
    if subcategory_update.name:
        subcategory.name = subcategory_update.name
    if subcategory_update.description is not None:
        subcategory.description = subcategory_update.description
    
    db.commit()
    db.refresh(subcategory)
    
    return subcategory

@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(
    subcategory_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Elimina (desactiva) una subcategoría personalizada.
    """
    if not current_user.family_id:
        raise HTTPException(status_code=400, detail="Usuario no pertenece a una familia")
    
    subcategory = db.query(models.CustomSubcategory).join(
        models.CustomCategory
    ).filter(
        models.CustomSubcategory.id == subcategory_id,
        models.CustomCategory.family_id == current_user.family_id
    ).first()
    
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategoría no encontrada")
    
    # Verificar si hay transacciones usando esta subcategoría
    transactions_count = db.query(models.Transaction).filter(
        models.Transaction.custom_subcategory_id == subcategory_id
    ).count()
    
    if transactions_count > 0:
        # Solo desactivar
        subcategory.is_active = False
        db.commit()
        return {"message": "Subcategoría desactivada (tiene transacciones asociadas)"}
    else:
        # Eliminar completamente
        db.delete(subcategory)
        db.commit()
        return {"message": "Subcategoría eliminada exitosamente"}
