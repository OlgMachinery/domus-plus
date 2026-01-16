from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from typing import List

router = APIRouter()

@router.post("/", response_model=schemas.FamilyResponse)
def create_family(family: schemas.FamilyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        # Validar que el nombre no esté vacío
        if not family.name or not family.name.strip():
            raise HTTPException(status_code=400, detail="El nombre de la familia es requerido")
        
        # Verificar que el usuario no tenga ya una familia
        if current_user.family_id:
            raise HTTPException(status_code=400, detail="Ya perteneces a una familia")
        
        db_family = models.Family(
            name=family.name.strip(),
            admin_id=current_user.id
        )
        db.add(db_family)
        db.flush()  # Para obtener el ID sin hacer commit
        
        # Asignar al usuario como admin y agregarlo a la familia
        current_user.family_id = db_family.id
        current_user.is_family_admin = True
        db.commit()
        db.refresh(db_family)
        
        return db_family
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al crear familia: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear familia: {str(e)}")

@router.get("/{family_id}", response_model=schemas.FamilyResponse)
def get_family(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    family = db.query(models.Family).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Familia no encontrada")
    
    # Verificar que el usuario pertenezca a la familia
    if current_user.family_id != family_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta familia")
    
    return family

@router.get("/{family_id}/members", response_model=List[schemas.UserResponse])
def get_family_members(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Obtiene todos los miembros de una familia"""
    family = db.query(models.Family).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Familia no encontrada")
    
    # Verificar que el usuario pertenezca a la familia
    if current_user.family_id != family_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta familia")
    
    members = db.query(models.User).filter(models.User.family_id == family_id).all()
    return members

@router.post("/{family_id}/members/{user_id}")
def add_member_to_family(family_id: int, user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    try:
        family = db.query(models.Family).filter(models.Family.id == family_id).first()
        if not family:
            raise HTTPException(status_code=404, detail="Familia no encontrada")
        
        # Verificar que el usuario actual sea admin
        if not current_user.is_family_admin or current_user.family_id != family_id:
            raise HTTPException(status_code=403, detail="Solo el administrador puede agregar miembros")
        
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Verificar que el usuario no pertenezca ya a otra familia
        if user.family_id and user.family_id != family_id:
            raise HTTPException(status_code=400, detail="El usuario ya pertenece a otra familia")
        
        if user.family_id == family_id:
            raise HTTPException(status_code=400, detail="El usuario ya pertenece a esta familia")
        
        user.family_id = family_id
        db.commit()
        
        return {"message": "Miembro agregado exitosamente"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al agregar miembro a la familia: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al agregar miembro: {str(e)}")

