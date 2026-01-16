from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from datetime import datetime
import hashlib

router = APIRouter()

# Integrantes de la familia según el Excel
FAMILY_MEMBERS = [
    {"name": "Gonzalo", "email": "gonzalo@domus.com", "phone": None},
    {"name": "Sebastian", "email": "sebastian@domus.com", "phone": None},
    {"name": "Emiliano", "email": "emiliano@domus.com", "phone": None},
    {"name": "Isabela", "email": "isabela@domus.com", "phone": None},
    {"name": "Santiago", "email": "santiago@domus.com", "phone": None},
    {"name": "Enrique", "email": "enrique@domus.com", "phone": None},
    {"name": "Mari de jesus", "email": "mari@domus.com", "phone": None},
]

# Emails de usuarios de prueba que deben eliminarse
TEST_USER_EMAILS = ["maria.gonzalez@test.com", "carlos.rodriguez@test.com"]

@router.post("/create-family-members")
def create_family_members(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Crea usuarios para todos los integrantes de la familia según el Excel.
    Todos los usuarios se crean con la misma contraseña: 'domus123'
    Requiere que el usuario actual sea admin de familia.
    """
    try:
        # Verificar que el usuario tenga familia
        if not current_user.family_id:
            raise HTTPException(
                status_code=400,
                detail="El usuario actual no tiene una familia asignada. Crea una familia primero."
            )
        
        # Verificar que sea admin
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador de la familia puede crear miembros."
            )
        
        family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
        if not family:
            raise HTTPException(status_code=404, detail="Familia no encontrada")
        
        # Contraseña única para todos los usuarios
        DEFAULT_PASSWORD = "domus123"
        
        # PRIMERO: Eliminar usuarios de prueba si existen
        test_users = db.query(models.User).filter(
            models.User.email.in_(TEST_USER_EMAILS)
        ).all()
        
        deleted_test_users = 0
        for test_user in test_users:
            # Eliminar transacciones del usuario de prueba
            db.query(models.Transaction).filter(
                models.Transaction.user_id == test_user.id
            ).delete(synchronize_session=False)
            
            # Eliminar presupuestos de usuario
            db.query(models.UserBudget).filter(
                models.UserBudget.user_id == test_user.id
            ).delete(synchronize_session=False)
            
            # Eliminar el usuario
            db.delete(test_user)
            deleted_test_users += 1
        
        if deleted_test_users > 0:
            db.flush()
            print(f"✅ Eliminados {deleted_test_users} usuarios de prueba")
        
        created_users = []
        existing_users = []
        errors = []
        
        for member_data in FAMILY_MEMBERS:
            try:
                # Verificar si el usuario ya existe
                existing_user = db.query(models.User).filter(
                    models.User.email == member_data["email"]
                ).first()
                
                if existing_user:
                    # Si existe pero no está en la familia, agregarlo
                    if existing_user.family_id != family.id:
                        existing_user.family_id = family.id
                        db.add(existing_user)
                        db.flush()
                        existing_users.append(existing_user)
                        print(f"✅ Usuario {existing_user.name} agregado a la familia")
                    else:
                        existing_users.append(existing_user)
                        print(f"ℹ️  Usuario {existing_user.name} ya está en la familia")
                else:
                    # Crear nuevo usuario con la contraseña única
                    # Truncar contraseña si es muy larga (bcrypt límite 72 bytes)
                    password_to_hash = DEFAULT_PASSWORD
                    if len(password_to_hash.encode('utf-8')) > 72:
                        password_to_hash = password_to_hash.encode('utf-8')[:72].decode('utf-8', errors='ignore')
                    
                    hashed_password = auth.get_password_hash(password_to_hash)
                    
                    # Asignar teléfono por defecto si no se proporciona (el campo es NOT NULL y UNIQUE)
                    # Generar un teléfono único basado en el nombre y email
                    if member_data.get("phone"):
                        phone_value = member_data["phone"]
                    else:
                        # Generar teléfono único: usar hash del email para asegurar unicidad
                        email_hash = hashlib.md5(member_data["email"].encode()).hexdigest()[:8]
                        phone_value = f"+52555{email_hash}"
                    
                    new_user = models.User(
                        name=member_data["name"],
                        email=member_data["email"],
                        phone=phone_value,
                        hashed_password=hashed_password,
                        family_id=family.id,
                        is_active=True,
                        is_family_admin=False  # Solo el usuario actual es admin
                    )
                    db.add(new_user)
                    db.flush()
                    created_users.append({
                        "user": new_user,
                        "password": DEFAULT_PASSWORD
                    })
                    print(f"✅ Usuario creado: {new_user.name} ({new_user.email}) - Password: {DEFAULT_PASSWORD}")
            
            except Exception as e:
                error_msg = f"Error al crear usuario {member_data['name']}: {str(e)}"
                errors.append(error_msg)
                print(f"❌ {error_msg}")
                continue
        
        db.commit()
        
        return {
            "message": "Miembros de la familia creados/actualizados",
            "summary": {
                "test_users_deleted": deleted_test_users,
                "created": len(created_users),
                "existing": len(existing_users),
                "errors": len(errors),
                "default_password": DEFAULT_PASSWORD,
                "users": [
                    {
                        "id": u["user"].id,
                        "name": u["user"].name,
                        "email": u["user"].email,
                        "password": u["password"]
                    }
                    for u in created_users
                ] + [
                    {
                        "id": u.id,
                        "name": u.name,
                        "email": u.email,
                        "password": None  # No mostrar contraseña de usuarios existentes
                    }
                    for u in existing_users
                ],
                "errors": errors
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear miembros de la familia: {str(e)}")

@router.post("/delete-test-users")
def delete_test_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Elimina específicamente los usuarios de prueba: María González y Carlos Rodríguez.
    """
    try:
        # Verificar que sea admin
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador puede eliminar usuarios de prueba"
            )
        
        # Buscar usuarios de prueba en toda la base de datos
        test_users = db.query(models.User).filter(
            models.User.email.in_(TEST_USER_EMAILS)
        ).all()
        
        if not test_users:
            return {
                "message": "No se encontraron usuarios de prueba para eliminar",
                "summary": {
                    "deleted": 0,
                    "transactions_deleted": 0,
                    "user_budgets_deleted": 0
                }
            }
        
        deleted_counts = {
            "users": 0,
            "transactions": 0,
            "user_budgets": 0
        }
        
        for test_user in test_users:
            # Eliminar todas las transacciones del usuario
            transactions_deleted = db.query(models.Transaction).filter(
                models.Transaction.user_id == test_user.id
            ).delete(synchronize_session=False)
            deleted_counts["transactions"] += transactions_deleted
            
            # Eliminar todos los presupuestos de usuario
            user_budgets_deleted = db.query(models.UserBudget).filter(
                models.UserBudget.user_id == test_user.id
            ).delete(synchronize_session=False)
            deleted_counts["user_budgets"] += user_budgets_deleted
            
            # Eliminar el usuario
            db.delete(test_user)
            deleted_counts["users"] += 1
        
        db.commit()
        
        return {
            "message": "Usuarios de prueba eliminados exitosamente",
            "summary": deleted_counts
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar usuarios de prueba: {str(e)}")

@router.post("/clear-all-data")
def clear_all_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Elimina TODOS los datos del sistema: transacciones, presupuestos y usuarios (excepto el usuario actual).
    Útil para empezar desde cero con datos del Excel.
    NOTA: Este endpoint elimina TODO, dejando solo el usuario actual.
    """
    try:
        # Verificar que el usuario tenga familia
        if not current_user.family_id:
            raise HTTPException(
                status_code=400,
                detail="El usuario actual no tiene una familia asignada."
            )
        
        # Verificar que sea admin
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador de la familia puede limpiar todos los datos."
            )
        
        family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
        if not family:
            raise HTTPException(status_code=404, detail="Familia no encontrada")
        
        deleted_counts = {
            "transactions": 0,
            "user_budgets": 0,
            "family_budgets": 0,
            "users": 0,
            "test_users": 0
        }
        
        # PRIMERO: Eliminar usuarios de prueba específicos
        test_users = db.query(models.User).filter(
            models.User.email.in_(TEST_USER_EMAILS)
        ).all()
        
        for test_user in test_users:
            # Eliminar transacciones
            db.query(models.Transaction).filter(
                models.Transaction.user_id == test_user.id
            ).delete(synchronize_session=False)
            
            # Eliminar presupuestos de usuario
            db.query(models.UserBudget).filter(
                models.UserBudget.user_id == test_user.id
            ).delete(synchronize_session=False)
            
            # Eliminar el usuario
            db.delete(test_user)
            deleted_counts["test_users"] += 1
        
        # Obtener todos los usuarios de la familia (INCLUYENDO el actual para eliminar sus transacciones también)
        all_family_users = db.query(models.User).filter(
            models.User.family_id == family.id
        ).all()
        
        all_family_user_ids = [u.id for u in all_family_users]
        
        # Asegurar que el usuario actual esté incluido
        if current_user.id not in all_family_user_ids:
            all_family_user_ids.append(current_user.id)
        
        # Eliminar TODAS las transacciones de la familia (incluyendo las del usuario actual)
        # Usar delete() directamente en la query para mejor rendimiento
        if all_family_user_ids:
            deleted_result = db.query(models.Transaction).filter(
                models.Transaction.user_id.in_(all_family_user_ids)
            ).delete(synchronize_session=False)
            deleted_counts["transactions"] = deleted_result
        else:
            # Si no hay usuarios, eliminar todas las transacciones del usuario actual
            deleted_result = db.query(models.Transaction).filter(
                models.Transaction.user_id == current_user.id
            ).delete(synchronize_session=False)
            deleted_counts["transactions"] = deleted_result
        
        # Eliminar también cualquier transacción huérfana que pueda quedar
        # (transacciones sin usuario válido o con user_id que no existe)
        orphan_count = 0
        try:
            # Obtener todos los user_ids válidos
            valid_user_ids = [u.id for u in db.query(models.User).all()]
            if valid_user_ids:
                orphan_transactions = db.query(models.Transaction).filter(
                    ~models.Transaction.user_id.in_(valid_user_ids)
                ).delete(synchronize_session=False)
                orphan_count = orphan_transactions
        except:
            pass
        
        if orphan_count > 0:
            deleted_counts["transactions"] += orphan_count
            print(f"⚠️  Se eliminaron {orphan_count} transacciones huérfanas adicionales")
        
        # Eliminar TODOS los presupuestos familiares (de todos los años, no solo el actual)
        family_budgets = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == family.id
        ).all()
        
        # Eliminar primero TODOS los user_budgets asociados usando delete() directo
        for budget in family_budgets:
            deleted_user_budgets = db.query(models.UserBudget).filter(
                models.UserBudget.family_budget_id == budget.id
            ).delete(synchronize_session=False)
            deleted_counts["user_budgets"] += deleted_user_budgets
        
        # Eliminar todos los presupuestos familiares
        deleted_family_budgets = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == family.id
        ).delete(synchronize_session=False)
        deleted_counts["family_budgets"] = deleted_family_budgets
        
        # Eliminar usuarios de la familia (excepto el actual)
        users_to_delete = [u for u in all_family_users if u.id != current_user.id]
        deleted_counts["users"] = len(users_to_delete)
        for user in users_to_delete:
            user.family_id = None
            db.delete(user)
        
        db.commit()
        
        return {
            "message": "Todos los datos han sido eliminados exitosamente",
            "summary": deleted_counts,
            "note": "El usuario actual se mantiene en el sistema. Usuarios de prueba eliminados."
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al limpiar datos: {str(e)}")
