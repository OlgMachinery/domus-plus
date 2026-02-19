from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from datetime import timedelta
from pydantic import BaseModel
from typing import Optional

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

@router.get("/login")
def login_get_info():
    """Respuesta para GET /login: el login debe hacerse por POST con email y contraseña."""
    return {
        "detail": "El login es por POST. Envía JSON: { \"email\": \"tu@email.com\", \"password\": \"tu_contraseña\" }",
        "method": "POST",
        "body_example": {"email": "tu@email.com", "password": "tu_contraseña"},
        "docs": "/docs",
    }


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

class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str
    phone: str
    family_id: Optional[int] = None

@router.post("/create")
def create_user_by_admin(
    user_data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Crea un nuevo usuario. Solo los administradores de familia pueden usar este endpoint.
    Crea el usuario tanto en auth.users (Supabase) como en public.users (nuestra tabla).
    """
    try:
        # Verificar que el usuario sea administrador
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo los administradores de familia pueden crear usuarios"
            )

        # Validaciones
        if len(user_data.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="La contraseña debe tener al menos 6 caracteres"
            )

        if not user_data.phone or len(user_data.phone.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="Teléfono inválido"
            )

        # Verificar si el email ya existe en Supabase
        try:
            from app.supabase_client import supabase_admin
            
            # Verificar email en Supabase
            email_check = supabase_admin.table('users').select('id, email').eq('email', user_data.email.strip()).execute()
            if email_check.data and len(email_check.data) > 0:
                raise HTTPException(
                    status_code=400,
                    detail="Email ya registrado"
                )
            
            # Verificar teléfono en Supabase
            phone_check = supabase_admin.table('users').select('id, phone').eq('phone', user_data.phone.strip()).execute()
            if phone_check.data and len(phone_check.data) > 0:
                raise HTTPException(
                    status_code=400,
                    detail="Teléfono ya registrado"
                )
        except HTTPException:
            raise
        except ImportError:
            # Si no hay Supabase, usar la BD local (fallback)
            existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Email ya registrado"
                )
            existing_user = db.query(models.User).filter(models.User.phone == user_data.phone.strip()).first()
            if existing_user:
                raise HTTPException(
                    status_code=400,
                    detail="Teléfono ya registrado"
                )
        except Exception as e:
            print(f"⚠️  Error verificando usuario existente: {e}")
            # Continuar de todas formas, Supabase rechazará si existe

        # Usar el family_id del administrador si no se proporciona
        target_family_id = user_data.family_id or current_user.family_id
        if not target_family_id:
            raise HTTPException(
                status_code=400,
                detail="El administrador no tiene familia asignada"
            )

        # Crear usuario en Supabase Auth usando service_role key
        try:
            from app.supabase_client import supabase_admin
            
            # Crear usuario en auth.users
            auth_response = supabase_admin.auth.admin.create_user({
                "email": user_data.email.strip(),
                "password": user_data.password,
                "email_confirm": True,  # Confirmar email automáticamente
                "user_metadata": {
                    "name": user_data.name.strip(),
                    "phone": user_data.phone.strip(),
                }
            })

            if not auth_response.user:
                raise HTTPException(
                    status_code=500,
                    detail="No se pudo crear el usuario en Supabase Auth"
                )

            auth_user_id = auth_response.user.id

        except ImportError:
            # Si no hay cliente de Supabase configurado, crear solo en la BD local
            print("⚠️  Supabase no configurado, creando usuario solo en BD local")
            # Generar un UUID temporal (en producción esto debería venir de Supabase)
            import uuid
            auth_user_id = str(uuid.uuid4())
        except Exception as e:
            print(f"❌ Error creando usuario en Supabase Auth: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al crear usuario en Supabase: {str(e)}"
            )

        # Crear usuario en nuestra tabla users (Supabase)
        # En Supabase, el id es UUID y viene de auth.users
        try:
            # Usar Supabase directamente para insertar en public.users
            from app.supabase_client import supabase_admin
            
            # Insertar en public.users usando el cliente de Supabase
            user_data_dict = {
                'id': str(auth_user_id),  # Asegurar que sea string (UUID)
                'email': user_data.email.strip(),
                'phone': user_data.phone.strip(),
                'name': user_data.name.strip(),
                'is_active': True,
                'is_family_admin': False,
                'family_id': target_family_id
            }
            
            print(f"🔧 Intentando insertar usuario en public.users: {user_data_dict}")
            
            user_response = supabase_admin.table('users').insert(user_data_dict).execute()

            # Verificar errores en la respuesta
            if hasattr(user_response, 'error') and user_response.error:
                error_msg = f"Error de Supabase: {user_response.error.message}"
                print(f"❌ {error_msg}")
                raise Exception(error_msg)

            if not user_response.data or len(user_response.data) == 0:
                raise HTTPException(
                    status_code=500,
                    detail="No se pudo crear el usuario en la tabla users (respuesta vacía)"
                )

            # Retornar el usuario creado
            created_user = user_response.data[0]
            print(f"✅ Usuario creado exitosamente: {created_user.get('email')}")
            
            # Retornar directamente el diccionario
            return created_user
        except HTTPException:
            # Re-lanzar HTTPException sin modificar
            raise
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Error al crear usuario en public.users: {error_msg}")
            import traceback
            traceback.print_exc()
            
            # Si falla, intentar eliminar el usuario de auth
            try:
                from app.supabase_client import supabase_admin
                supabase_admin.auth.admin.delete_user(str(auth_user_id))
                print(f"🗑️  Usuario eliminado de auth.users debido al error")
            except Exception as delete_error:
                print(f"⚠️  No se pudo eliminar usuario de auth.users: {delete_error}")
            
            # Mensaje de error más descriptivo
            if "row-level security" in error_msg.lower() or "rls" in error_msg.lower():
                raise HTTPException(
                    status_code=500,
                    detail=f"Error de permisos (RLS): Las políticas de seguridad están bloqueando la creación. Ejecuta el SQL de 'supabase/rls-admin-crear-usuarios.sql' en Supabase. Error: {error_msg}"
                )
            elif "duplicate" in error_msg.lower() or "unique" in error_msg.lower() or "already exists" in error_msg.lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"El usuario ya existe en la base de datos. Error: {error_msg}"
                )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Error al crear usuario en la base de datos: {error_msg}"
                )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error al crear usuario: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error al crear usuario: {str(e)}"
        )
