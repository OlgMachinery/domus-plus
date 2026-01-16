#!/usr/bin/env python3
"""
Script de migración para agregar campo transaction_type a la tabla transactions
y income_amount a user_budgets.
"""
import sqlite3
import os
from pathlib import Path

# Ruta a la base de datos
db_path = Path(__file__).parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

print(f"📊 Migrando base de datos: {db_path}")

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar si las columnas ya existen
    cursor.execute("PRAGMA table_info(transactions)")
    transaction_columns = [col[1] for col in cursor.fetchall()]
    
    # Agregar transaction_type a transactions si no existe
    if 'transaction_type' not in transaction_columns:
        print("➕ Agregando columna 'transaction_type' a transactions...")
        cursor.execute("ALTER TABLE transactions ADD COLUMN transaction_type VARCHAR(20) DEFAULT 'expense'")
        # Actualizar registros existentes (todos son egresos por defecto)
        cursor.execute("UPDATE transactions SET transaction_type = 'expense' WHERE transaction_type IS NULL")
        print("✅ Columna 'transaction_type' agregada")
    else:
        print("✓ Columna 'transaction_type' ya existe")
    
    # Verificar columnas de user_budgets
    cursor.execute("PRAGMA table_info(user_budgets)")
    budget_columns = [col[1] for col in cursor.fetchall()]
    
    # Agregar income_amount a user_budgets si no existe
    if 'income_amount' not in budget_columns:
        print("➕ Agregando columna 'income_amount' a user_budgets...")
        cursor.execute("ALTER TABLE user_budgets ADD COLUMN income_amount FLOAT DEFAULT 0.0")
        cursor.execute("UPDATE user_budgets SET income_amount = 0.0 WHERE income_amount IS NULL")
        print("✅ Columna 'income_amount' agregada")
    else:
        print("✓ Columna 'income_amount' ya existe")
    
    conn.commit()
    print("\n✅ Migración completada exitosamente!")
    
except Exception as e:
    conn.rollback()
    print(f"\n❌ Error durante la migración: {str(e)}")
    exit(1)
finally:
    conn.close()
