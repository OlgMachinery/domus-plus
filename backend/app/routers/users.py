from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from datetime import timedelta
from pydantic import BaseModel

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

class PasswordVerifyRequest(BaseModel):
    password: str

@router.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        # Validar longitud mínima de contraseña
        if len(user.password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
        
        # Validar formato de email (ya validado por EmailStr en schemas)
        # Validar formato de teléfono básico
        if not user.phone or len(user.phone.strip()) < 10:
            raise HTTPException(status_code=400, detail="Teléfono inválido")
        
        # Verificar si el email ya existe
        db_user = db.query(models.User).filter(models.User.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email ya registrado")
        
        # Verificar si el teléfono ya existe
        db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Teléfono ya registrado")
        
        # Crear usuario
        hashed_password = auth.get_password_hash(user.password)
        db_user = models.User(
            email=user.email,
            phone=user.phone.strip(),
            name=user.name.strip(),
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al registrar usuario: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al registrar usuario: {str(e)}")

@router.post("/login", response_model=schemas.Token)
def login_user(user_credentials: LoginRequest, db: Session = Depends(get_db)):
    try:
        print(f"🔐 Intento de login para email: {user_credentials.email}")
        
        # Buscar usuario
        user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
        if not user:
            print(f"❌ Usuario no encontrado: {user_credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"✅ Usuario encontrado: {user.email} (ID: {user.id})")
        print(f"🔑 Verificando contraseña...")
        
        # Verificar contraseña
        if not auth.verify_password(user_credentials.password, user.hashed_password):
            print(f"❌ Contraseña incorrecta para usuario: {user_credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"✅ Contraseña correcta, generando token...")
        
        # Verificar que el usuario esté activo
        if not user.is_active:
            print(f"❌ Usuario inactivo: {user_credentials.email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo. Contacta al administrador.",
            )
        
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )
        
        print(f"✅ Token generado exitosamente para: {user.email}")
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Error inesperado en login: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar el login: {str(e)}"
        )

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.post("/verify-password")
def verify_password(
    request: PasswordVerifyRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Verifica la contraseña del usuario actual.
    Solo los administradores de familia pueden usar este endpoint.
    """
    if not current_user.is_family_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden verificar contraseñas"
        )
    
    if auth.verify_password(request.password, current_user.hashed_password):
        return {"valid": True}
    else:
        return {"valid": False}

@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Solo permitir ver el propio perfil o usuarios de la misma familia
    if user_id != current_user.id:
        if not current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este usuario")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if user.family_id != current_user.family_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este usuario")
    else:
        user = current_user
    
    return user
