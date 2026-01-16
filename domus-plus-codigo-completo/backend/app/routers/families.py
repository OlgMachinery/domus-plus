from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth

router = APIRouter()

@router.post("/", response_model=schemas.FamilyResponse)
def create_family(family: schemas.FamilyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    db_family = models.Family(
        name=family.name,
        admin_id=current_user.id
    )
    db.add(db_family)
    db.commit()
    db.refresh(db_family)
    
    # Asignar al usuario como admin y agregarlo a la familia
    current_user.family_id = db_family.id
    current_user.is_family_admin = True
    db.commit()
    
    return db_family

@router.get("/{family_id}", response_model=schemas.FamilyResponse)
def get_family(family_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    family = db.query(models.Family).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Familia no encontrada")
    
    # Verificar que el usuario pertenezca a la familia
    if current_user.family_id != family_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta familia")
    
    return family

@router.post("/{family_id}/members/{user_id}")
def add_member_to_family(family_id: int, user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    family = db.query(models.Family).filter(models.Family.id == family_id).first()
    if not family:
        raise HTTPException(status_code=404, detail="Familia no encontrada")
    
    # Verificar que el usuario actual sea admin
    if not current_user.is_family_admin or current_user.family_id != family_id:
        raise HTTPException(status_code=403, detail="Solo el administrador puede agregar miembros")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.family_id = family_id
    db.commit()
    
    return {"message": "Miembro agregado exitosamente"}

