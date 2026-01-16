#!/usr/bin/env python3
"""Script para agregar columnas faltantes a family_budgets"""
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "domus_plus.db"
if not db_path.exists():
    db_path = Path(__file__).parent / "domus_plus.db"

print(f"📊 Conectando a la base de datos: {db_path}")
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar columnas existentes
    cursor.execute('PRAGMA table_info(family_budgets)')
    cols = [col[1] for col in cursor.fetchall()]
    print(f"Columnas actuales: {cols}")
    
    # Agregar custom_category_id si no existe
    if 'custom_category_id' not in cols:
        print("➕ Agregando columna custom_category_id...")
        cursor.execute('ALTER TABLE family_budgets ADD COLUMN custom_category_id INTEGER')
        print("✅ Columna custom_category_id agregada")
    else:
        print("✓ Columna custom_category_id ya existe")
    
    # Agregar custom_subcategory_id si no existe
    if 'custom_subcategory_id' not in cols:
        print("➕ Agregando columna custom_subcategory_id...")
        cursor.execute('ALTER TABLE family_budgets ADD COLUMN custom_subcategory_id INTEGER')
        print("✅ Columna custom_subcategory_id agregada")
    else:
        print("✓ Columna custom_subcategory_id ya existe")
    
    conn.commit()
    print("\n✅ Migración completada exitosamente!")
    
except Exception as e:
    conn.rollback()
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    conn.close()
