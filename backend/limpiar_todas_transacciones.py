#!/usr/bin/env python3
"""
Script para eliminar TODAS las transacciones de la base de datos.
Útil cuando los datos ficticios persisten después de usar los endpoints.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models

def limpiar_todas_transacciones():
    """Elimina TODAS las transacciones de la base de datos"""
    db = SessionLocal()
    try:
        # Contar transacciones antes
        total_before = db.query(models.Transaction).count()
        print(f"📊 Transacciones antes: {total_before}")
        
        if total_before == 0:
            print("✅ No hay transacciones para eliminar")
            return
        
        # Mostrar algunas transacciones antes de eliminar
        print("\n📋 Primeras 10 transacciones que se eliminarán:")
        sample_transactions = db.query(models.Transaction).limit(10).all()
        for t in sample_transactions:
            print(f"  - ID: {t.id}, Concepto: {t.concept or t.merchant_or_beneficiary or 'N/A'}, Monto: ${t.amount:,.2f}, Usuario ID: {t.user_id}")
        
        # Eliminar TODAS las transacciones usando delete() directo
        deleted = db.query(models.Transaction).delete(synchronize_session=False)
        db.commit()
        
        # Verificar
        total_after = db.query(models.Transaction).count()
        
        print(f"\n✅ Transacciones eliminadas: {deleted}")
        print(f"📊 Transacciones después: {total_after}")
        
        if total_after == 0:
            print("✅ Todas las transacciones fueron eliminadas exitosamente")
        else:
            print(f"⚠️  Aún quedan {total_after} transacciones")
            # Intentar eliminar de nuevo
            remaining = db.query(models.Transaction).delete(synchronize_session=False)
            db.commit()
            if remaining > 0:
                print(f"✅ Se eliminaron {remaining} transacciones adicionales")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("⚠️  ADVERTENCIA: Este script eliminará TODAS las transacciones de la base de datos")
    print("   Esto incluye transacciones de prueba, reales y cualquier dato ficticio.")
    confirm = input("\n¿Estás seguro? Escribe 'SI' para continuar: ")
    
    if confirm.upper() == 'SI':
        limpiar_todas_transacciones()
    else:
        print("❌ Operación cancelada")
