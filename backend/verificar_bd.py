#!/usr/bin/env python3
"""Script para verificar y corregir la base de datos"""
import sqlite3
from pathlib import Path

# Buscar la base de datos en el directorio actual primero (backend)
db_path = Path(__file__).parent / "domus_plus.db"
if not db_path.exists():
    db_path = Path(__file__).parent.parent / "domus_plus.db"

print(f"📊 Verificando base de datos: {db_path}")
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar tablas
    cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
    tables = [t[0] for t in cursor.fetchall()]
    print(f"\n📋 Tablas encontradas: {len(tables)}")
    for table in tables:
        print(f"   - {table}")
    
    # Verificar family_budgets
    if 'family_budgets' in tables:
        cursor.execute('PRAGMA table_info(family_budgets)')
        cols = [col[1] for col in cursor.fetchall()]
        print(f"\n📊 Columnas en family_budgets: {len(cols)}")
        print(f"   {', '.join(cols)}")
        
        has_custom_cat = 'custom_category_id' in cols
        has_custom_sub = 'custom_subcategory_id' in cols
        
        print(f"\n✅ custom_category_id: {'Sí' if has_custom_cat else '❌ No'}")
        print(f"✅ custom_subcategory_id: {'Sí' if has_custom_sub else '❌ No'}")
        
        if not has_custom_cat or not has_custom_sub:
            print("\n🔧 Agregando columnas faltantes...")
            if not has_custom_cat:
                cursor.execute('ALTER TABLE family_budgets ADD COLUMN custom_category_id INTEGER')
                print("   ✅ custom_category_id agregada")
            if not has_custom_sub:
                cursor.execute('ALTER TABLE family_budgets ADD COLUMN custom_subcategory_id INTEGER')
                print("   ✅ custom_subcategory_id agregada")
            conn.commit()
            print("\n✅ Base de datos actualizada!")
        else:
            print("\n✅ Todas las columnas están presentes")
    else:
        print("\n⚠️  Tabla family_budgets no existe (se creará automáticamente al usar el sistema)")
    
    # Verificar transactions
    if 'transactions' in tables:
        cursor.execute('PRAGMA table_info(transactions)')
        cols = [col[1] for col in cursor.fetchall()]
        has_custom_cat = 'custom_category_id' in cols
        has_custom_sub = 'custom_subcategory_id' in cols
        
        print(f"\n📊 Transacciones:")
        print(f"   ✅ custom_category_id: {'Sí' if has_custom_cat else '❌ No'}")
        print(f"   ✅ custom_subcategory_id: {'Sí' if has_custom_sub else '❌ No'}")
        
        if not has_custom_cat or not has_custom_sub:
            print("\n🔧 Agregando columnas faltantes a transactions...")
            if not has_custom_cat:
                cursor.execute('ALTER TABLE transactions ADD COLUMN custom_category_id INTEGER')
                print("   ✅ custom_category_id agregada")
            if not has_custom_sub:
                cursor.execute('ALTER TABLE transactions ADD COLUMN custom_subcategory_id INTEGER')
                print("   ✅ custom_subcategory_id agregada")
            conn.commit()
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    conn.close()

print("\n✅ Verificación completada")
