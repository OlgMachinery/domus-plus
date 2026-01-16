from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, auth
from app.models import Category, Subcategory
from datetime import datetime, timedelta
import random

router = APIRouter()

@router.post("/load-test-data")
def load_test_data(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Carga datos de prueba completos para testing profesional.
    Crea usuarios, familia, presupuestos y transacciones.
    """
    try:
        # Si no tiene familia, crear una automáticamente
        if not current_user.family_id:
            family = models.Family(
                name="Mi Familia",
                admin_id=current_user.id
            )
            db.add(family)
            db.flush()
            
            current_user.family_id = family.id
            current_user.is_family_admin = True
            db.add(current_user)
            db.commit()
            db.refresh(family)
        else:
            family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
            if not family:
                raise HTTPException(status_code=404, detail="Familia no encontrada")
            
            # Si no es admin, hacerlo admin
            if not current_user.is_family_admin:
                current_user.is_family_admin = True
                db.add(current_user)
                db.commit()
        
        # Datos de usuarios de prueba
        test_users_data = [
            {
                "name": "María González",
                "email": "maria.gonzalez@test.com",
                "phone": "+525551234567",
                "password": "test123"
            },
            {
                "name": "Carlos Rodríguez",
                "email": "carlos.rodriguez@test.com",
                "phone": "+525559876543",
                "password": "test123"
            }
        ]
        
        created_users = []
        for user_data in test_users_data:
            # Verificar si el usuario ya existe
            existing_user = db.query(models.User).filter(
                models.User.email == user_data["email"]
            ).first()
            
            if not existing_user:
                # Truncar contraseña si es muy larga (bcrypt límite 72 bytes)
                password_to_hash = user_data["password"]
                if len(password_to_hash.encode('utf-8')) > 72:
                    password_to_hash = password_to_hash.encode('utf-8')[:72].decode('utf-8', errors='ignore')
                hashed_password = auth.get_password_hash(password_to_hash)
                new_user = models.User(
                    name=user_data["name"],
                    email=user_data["email"],
                    phone=user_data["phone"],
                    hashed_password=hashed_password,
                    family_id=family.id,
                    is_active=True
                )
                db.add(new_user)
                db.flush()
                created_users.append(new_user)
            else:
                # Si existe, agregarlo a la familia si no está
                if existing_user.family_id != family.id:
                    existing_user.family_id = family.id
                    db.add(existing_user)
                    db.flush()
                created_users.append(existing_user)
        
        # Presupuestos familiares de prueba (año actual)
        current_year = datetime.now().year
        test_budgets = [
            {"category": "Servicios Basicos", "subcategory": "Electricidad CFE", "amount": 24000},
            {"category": "Servicios Basicos", "subcategory": "Agua Potable", "amount": 6000},
            {"category": "Servicios Basicos", "subcategory": "Internet", "amount": 12000},
            {"category": "Mercado", "subcategory": "Mercado General", "amount": 120000},
            {"category": "Vivienda", "subcategory": "Seguro Vivienda", "amount": 15000},
            {"category": "Transporte", "subcategory": "Gasolina", "amount": 36000},
            {"category": "Transporte", "subcategory": "Mantenimiento coches", "amount": 24000},
            {"category": "Salud", "subcategory": "Seguro Medico", "amount": 48000},
            {"category": "Educacion", "subcategory": "Colegiaturas", "amount": 180000},
            {"category": "Vida Social", "subcategory": "Salidas Familiares", "amount": 36000},
        ]
        
        # Eliminar presupuestos existentes del año actual para recrearlos
        existing_budgets = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == family.id,
            models.FamilyBudget.year == current_year
        ).all()
        
        for existing_budget in existing_budgets:
            # Eliminar user_budgets asociados
            user_budgets = db.query(models.UserBudget).filter(
                models.UserBudget.family_budget_id == existing_budget.id
            ).all()
            for user_budget in user_budgets:
                db.delete(user_budget)
            db.delete(existing_budget)
        db.flush()
        
        # Crear todos los presupuestos de prueba
        created_budgets = []
        for budget_data in test_budgets:
            # Convertir strings a enums
            try:
                category_enum = Category(budget_data["category"])
                subcategory_enum = Subcategory(budget_data["subcategory"])
            except ValueError as e:
                # Log del error pero continuar con el siguiente
                print(f"⚠️ Error convirtiendo categoría/subcategoría: {budget_data} - {str(e)}")
                # Intentar buscar el enum por valor
                try:
                    # Buscar por valor del enum
                    for cat in Category:
                        if cat.value == budget_data["category"]:
                            category_enum = cat
                            break
                    else:
                        print(f"❌ No se encontró categoría: {budget_data['category']}")
                        continue
                    
                    for subcat in Subcategory:
                        if subcat.value == budget_data["subcategory"]:
                            subcategory_enum = subcat
                            break
                    else:
                        print(f"❌ No se encontró subcategoría: {budget_data['subcategory']}")
                        continue
                except Exception as e2:
                    print(f"❌ Error al buscar enum: {str(e2)}")
                    continue
            
            try:
                new_budget = models.FamilyBudget(
                    family_id=family.id,
                    category=category_enum,
                    subcategory=subcategory_enum,
                    year=current_year,
                    total_amount=budget_data["amount"],
                    budget_type=models.BudgetType.SHARED.value,  # Presupuestos de prueba son compartidos
                    distribution_method=models.DistributionMethod.EQUAL.value,  # Distribución equitativa
                    auto_distribute=True
                )
                db.add(new_budget)
                db.flush()  # Flush para obtener el ID
                created_budgets.append(new_budget)
                print(f"✅ Presupuesto creado: {budget_data['category']} - {budget_data['subcategory']}")
            except Exception as e:
                print(f"❌ Error al crear presupuesto {budget_data}: {str(e)}")
                db.rollback()
                continue
        
        if not created_budgets:
            raise HTTPException(status_code=500, detail="No se pudieron crear los presupuestos. Verifica los valores de categoría y subcategoría.")
        
        db.commit()  # Commit para que los presupuestos estén disponibles
        
        # Refrescar todos los presupuestos para asegurar que tienen IDs válidos
        for budget in created_budgets:
            db.refresh(budget)
        
        print(f"✅ Total de presupuestos creados: {len(created_budgets)}")
        for budget in created_budgets:
            print(f"  - ID: {budget.id}, {budget.category.value} - {budget.subcategory.value}, ${budget.total_amount}")
        
        # Asignar presupuestos a usuarios
        all_family_users = [current_user] + created_users
        user_budgets_created = []
        
        print(f"📊 Asignando presupuestos a {len(all_family_users)} usuarios...")
        for budget in created_budgets:
            # Verificar que el presupuesto tenga un ID válido
            if not budget.id:
                print(f"⚠️ Presupuesto sin ID: {budget.category.value} - {budget.subcategory.value}")
                continue
                
            # Distribuir el presupuesto entre los usuarios
            num_users = len(all_family_users)
            amount_per_user = budget.total_amount / num_users
            
            for user in all_family_users:
                # Verificar si ya existe la asignación
                existing_allocation = db.query(models.UserBudget).filter(
                    models.UserBudget.user_id == user.id,
                    models.UserBudget.family_budget_id == budget.id
                ).first()
                
                if not existing_allocation:
                    user_budget = models.UserBudget(
                        user_id=user.id,
                        family_budget_id=budget.id,
                        allocated_amount=round(amount_per_user, 2),
                        spent_amount=0.0
                    )
                    db.add(user_budget)
                    user_budgets_created.append(user_budget)
                    print(f"  ✅ Asignado ${round(amount_per_user, 2)} a usuario {user.name} (ID: {user.id}) para presupuesto {budget.id}")
        
        db.commit()  # Commit para que los user_budgets estén disponibles
        print(f"✅ Total de asignaciones de presupuesto creadas: {len(user_budgets_created)}")
        
        # Crear transacciones de prueba (últimos 3 meses)
        transactions_data = []
        start_date = datetime.now() - timedelta(days=90)
        
        # Transacciones variadas
        transaction_templates = [
            {"category": "Servicios Basicos", "subcategory": "Electricidad CFE", "amount_range": (800, 1200), "merchants": ["CFE", "Comisión Federal de Electricidad"]},
            {"category": "Servicios Basicos", "subcategory": "Agua Potable", "amount_range": (150, 250), "merchants": ["SAPAS", "Sistema de Agua Potable"]},
            {"category": "Servicios Basicos", "subcategory": "Internet", "amount_range": (800, 1000), "merchants": ["Telmex", "Totalplay", "Izzi"]},
            {"category": "Mercado", "subcategory": "Mercado General", "amount_range": (500, 3000), "merchants": ["Walmart", "Soriana", "Chedraui", "La Comer"]},
            {"category": "Transporte", "subcategory": "Gasolina", "amount_range": (500, 800), "merchants": ["Pemex", "BP", "Shell"]},
            {"category": "Transporte", "subcategory": "Mantenimiento coches", "amount_range": (800, 2500), "merchants": ["Autozone", "Midas", "Llantera"]},
            {"category": "Salud", "subcategory": "Medicamentos", "amount_range": (200, 800), "merchants": ["Farmacia del Ahorro", "Farmacias Guadalajara", "Similares"]},
            {"category": "Vida Social", "subcategory": "Salidas Familiares", "amount_range": (500, 2000), "merchants": ["Restaurante", "Cine", "Parque"]},
        ]
        
        # Crear 30-40 transacciones distribuidas en los últimos 3 meses
        for i in range(35):
            template = random.choice(transaction_templates)
            days_ago = random.randint(0, 90)
            transaction_date = start_date + timedelta(days=days_ago, hours=random.randint(8, 20))
            
            amount = random.uniform(*template["amount_range"])
            merchant = random.choice(template["merchants"])
            
            # Asignar a un usuario aleatorio de la familia
            user = random.choice(all_family_users)
            
            # Buscar el presupuesto correspondiente
            family_budget = None
            user_budget = None
            for budget in created_budgets:
                # Comparar usando el valor del enum, no el objeto directamente
                budget_category = str(budget.category.value) if hasattr(budget.category, 'value') else str(budget.category)
                budget_subcategory = str(budget.subcategory.value) if hasattr(budget.subcategory, 'value') else str(budget.subcategory)
                
                if budget_category == template["category"] and budget_subcategory == template["subcategory"]:
                    family_budget = budget
                    user_budget = db.query(models.UserBudget).filter(
                        models.UserBudget.user_id == user.id,
                        models.UserBudget.family_budget_id == budget.id
                    ).first()
                    break
            
            # Convertir categoría y subcategoría a enums
            try:
                category_enum = Category(template["category"])
                subcategory_enum = Subcategory(template["subcategory"])
            except ValueError:
                # Si no coincide, usar el primero disponible
                category_enum = Category.SERVICIOS_BASICOS
                subcategory_enum = Subcategory.ELECTRICIDAD_CFE
            
            transaction = models.Transaction(
                user_id=user.id,
                family_budget_id=family_budget.id if family_budget else None,
                date=transaction_date,
                amount=round(amount, 2),
                currency="MXN",
                merchant_or_beneficiary=merchant,
                category=category_enum,
                subcategory=subcategory_enum,
                concept=f"Pago {template['subcategory']} - {merchant}",
                status=models.TransactionStatus.PROCESSED
            )
            db.add(transaction)
            transactions_data.append(transaction)
            
            # Actualizar el presupuesto gastado si hay user_budget
            if user_budget:
                user_budget.spent_amount = round(user_budget.spent_amount + amount, 2)
                db.add(user_budget)
        
        db.commit()
        
        # Verificar que los presupuestos se crearon correctamente
        final_budgets_count = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == family.id
        ).count()
        final_user_budgets_count = db.query(models.UserBudget).filter(
            models.UserBudget.user_id == current_user.id
        ).count()
        
        print(f"🔍 Verificación final:")
        print(f"  - Presupuestos familiares en BD: {final_budgets_count}")
        print(f"  - Presupuestos de usuario en BD: {final_user_budgets_count}")
        
        return {
            "message": "Datos de prueba cargados exitosamente",
            "summary": {
                "users_created": len(created_users),
                "budgets_created": len(created_budgets),
                "user_budgets_created": len(user_budgets_created),
                "transactions_created": len(transactions_data),
                "verification": {
                    "family_budgets_in_db": final_budgets_count,
                    "user_budgets_in_db": final_user_budgets_count
                }
            }
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cargar datos de prueba: {str(e)}")

@router.post("/clear-test-data")
def clear_test_data(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Limpia todos los datos de prueba del sistema.
    Elimina transacciones, presupuestos de usuario, presupuestos familiares y usuarios de prueba.
    NOTA: Para eliminar TODOS los datos y empezar desde cero, usa /api/family-setup/clear-all-data
    """
    try:
        # Si no tiene familia, no hay nada que limpiar
        if not current_user.family_id:
            return {
                "message": "No hay datos de prueba para limpiar",
                "summary": {
                    "transactions": 0,
                    "user_budgets": 0,
                    "family_budgets": 0,
                    "test_users": 0
                }
            }
        
        # Si no es admin, hacerlo admin automáticamente
        if not current_user.is_family_admin:
            current_user.is_family_admin = True
            db.add(current_user)
            db.commit()
        
        family = db.query(models.Family).filter(models.Family.id == current_user.family_id).first()
        if not family:
            raise HTTPException(status_code=404, detail="Familia no encontrada")
        
        # Emails de usuarios de prueba
        test_emails = ["maria.gonzalez@test.com", "carlos.rodriguez@test.com"]
        
        deleted_counts = {
            "transactions": 0,
            "user_budgets": 0,
            "family_budgets": 0,
            "test_users": 0
        }
        
        # Obtener usuarios de prueba
        test_users = db.query(models.User).filter(
            models.User.family_id == family.id,
            models.User.email.in_(test_emails)
        ).all()
        
        test_user_ids = [u.id for u in test_users]
        all_family_user_ids = [u.id for u in db.query(models.User).filter(
            models.User.family_id == family.id
        ).all()]
        
        # Eliminar TODAS las transacciones de la familia (no solo de usuarios de prueba)
        # Usar delete() directamente en la query para mejor rendimiento y asegurar eliminación
        deleted_result = db.query(models.Transaction).filter(
            models.Transaction.user_id.in_(all_family_user_ids)
        ).delete(synchronize_session=False)
        deleted_counts["transactions"] = deleted_result
        
        # Eliminar TODOS los presupuestos familiares del año actual
        family_budgets = db.query(models.FamilyBudget).filter(
            models.FamilyBudget.family_id == family.id,
            models.FamilyBudget.year == current_year
        ).all()
        
        # Eliminar primero TODOS los user_budgets asociados a estos presupuestos
        for budget in family_budgets:
            user_budgets = db.query(models.UserBudget).filter(
                models.UserBudget.family_budget_id == budget.id
            ).all()
            deleted_counts["user_budgets"] += len(user_budgets)
            for user_budget in user_budgets:
                db.delete(user_budget)
        
        deleted_counts["family_budgets"] = len(family_budgets)
        for budget in family_budgets:
            db.delete(budget)
        
        # Eliminar usuarios de prueba (eliminar de toda la base de datos, no solo de la familia)
        deleted_counts["test_users"] = len(test_users)
        for user in test_users:
            # Primero eliminar todas sus transacciones (por si acaso)
            db.query(models.Transaction).filter(
                models.Transaction.user_id == user.id
            ).delete(synchronize_session=False)
            
            # Eliminar sus presupuestos de usuario
            db.query(models.UserBudget).filter(
                models.UserBudget.user_id == user.id
            ).delete(synchronize_session=False)
            
            # Remover de la familia si está en una
            if user.family_id:
                user.family_id = None
                db.add(user)
            
            # Eliminar el usuario
            db.delete(user)
        
        db.commit()
        
        return {
            "message": "Datos de prueba eliminados exitosamente",
            "summary": deleted_counts,
            "note": "Para eliminar TODOS los datos (incluyendo usuarios reales), usa /api/family-setup/clear-all-data"
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al limpiar datos de prueba: {str(e)}")

@router.post("/delete-all-transactions")
def delete_all_transactions(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Elimina ABSOLUTAMENTE TODAS las transacciones de la base de datos.
    Sin importar a qué usuario pertenezcan o si están en una familia.
    Útil cuando las transacciones ficticias persisten.
    """
    try:
        # Verificar que sea admin
        if not current_user.is_family_admin:
            raise HTTPException(
                status_code=403,
                detail="Solo el administrador puede eliminar todas las transacciones"
            )
        
        # Contar antes
        total_before = db.query(models.Transaction).count()
        
        # Eliminar ABSOLUTAMENTE TODAS las transacciones
        deleted = db.query(models.Transaction).delete(synchronize_session=False)
        db.commit()
        
        # Verificar después
        total_after = db.query(models.Transaction).count()
        
        return {
            "message": "Todas las transacciones eliminadas exitosamente",
            "summary": {
                "deleted": deleted,
                "before": total_before,
                "after": total_after
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar transacciones: {str(e)}")
