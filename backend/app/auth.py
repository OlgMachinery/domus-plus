from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
import os

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Usar pbkdf2_sha256 en lugar de bcrypt para evitar límite de 72 bytes
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/users/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            print(f"❌ Contraseña o hash vacío en verify_password")
            return False
        
        result = pwd_context.verify(plain_password, hashed_password)
        if not result:
            print(f"⚠️  Verificación de contraseña falló")
        return result
    except Exception as e:
        print(f"❌ Error en verify_password: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def get_password_hash(password: str) -> str:
    # pbkdf2_sha256 no tiene límite de longitud como bcrypt
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    # Usar datetime.now() en lugar de utcnow() para mejor compatibilidad
    now = datetime.now()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, email: str, password: str):
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            print(f"❌ Usuario no encontrado en authenticate_user: {email}")
            return False
        
        if not user.hashed_password:
            print(f"❌ Usuario sin contraseña hash: {email}")
            return False
        
        print(f"🔑 Verificando contraseña en authenticate_user para: {email}")
        is_valid = verify_password(password, user.hashed_password)
        print(f"   Resultado verificación: {is_valid}")
        
        if not is_valid:
            return False
        
        if not user.is_active:
            print(f"❌ Usuario inactivo: {email}")
            return False
        
        return user
    except Exception as e:
        import traceback
        print(f"❌ Error en authenticate_user: {str(e)}")
        print(traceback.format_exc())
        return False

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

