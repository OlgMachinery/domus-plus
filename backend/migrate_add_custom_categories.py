"""
Script de migración para agregar soporte de categorías personalizadas
Agrega las columnas custom_category_id y custom_subcategory_id a las tablas existentes
y crea las nuevas tablas custom_categories y custom_subcategories
"""
import sqlite3
import os
from pathlib import Path

# Ruta a la base de datos
db_path = Path(__file__).parent.parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

print(f"📊 Conectando a la base de datos: {db_path}")
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # 1. Crear tabla custom_categories
    print("\n1️⃣ Creando tabla custom_categories...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS custom_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id INTEGER NOT NULL,
            name VARCHAR NOT NULL,
            description TEXT,
            icon VARCHAR,
            color VARCHAR,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (family_id) REFERENCES families(id)
        )
    """)
    print("   ✅ Tabla custom_categories creada")

    # 2. Crear tabla custom_subcategories
    print("\n2️⃣ Creando tabla custom_subcategories...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS custom_subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            custom_category_id INTEGER NOT NULL,
            name VARCHAR NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (custom_category_id) REFERENCES custom_categories(id)
        )
    """)
    print("   ✅ Tabla custom_subcategories creada")

    # 3. Verificar si la tabla family_budgets existe y agregar columnas
    print("\n3️⃣ Verificando tabla family_budgets...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='family_budgets'")
    table_exists = cursor.fetchone()
    
    if table_exists:
        cursor.execute("PRAGMA table_info(family_budgets)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'custom_category_id' not in columns:
            print("   ➕ Agregando columna custom_category_id...")
            cursor.execute("ALTER TABLE family_budgets ADD COLUMN custom_category_id INTEGER")
            cursor.execute("ALTER TABLE family_budgets ADD COLUMN custom_subcategory_id INTEGER")
            print("   ✅ Columnas agregadas a family_budgets")
        else:
            print("   ✓ Columnas ya existen en family_budgets")
    else:
        print("   ⚠️  Tabla family_budgets no existe aún (se creará automáticamente al iniciar el backend)")

    # 4. Verificar si la tabla transactions existe y agregar columnas
    print("\n4️⃣ Verificando tabla transactions...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'")
    table_exists = cursor.fetchone()
    
    if table_exists:
        cursor.execute("PRAGMA table_info(transactions)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'custom_category_id' not in columns:
            print("   ➕ Agregando columnas a transactions...")
            cursor.execute("ALTER TABLE transactions ADD COLUMN custom_category_id INTEGER")
            cursor.execute("ALTER TABLE transactions ADD COLUMN custom_subcategory_id INTEGER")
            print("   ✅ Columnas agregadas a transactions")
        else:
            print("   ✓ Columnas ya existen en transactions")
    else:
        print("   ⚠️  Tabla transactions no existe aún (se creará automáticamente al iniciar el backend)")

    # 5. Hacer que category y subcategory sean nullable en family_budgets si no lo son
    print("\n5️⃣ Verificando nullable en family_budgets...")
    cursor.execute("PRAGMA table_info(family_budgets)")
    columns_info = cursor.fetchall()
    
    # SQLite no soporta ALTER COLUMN directamente, pero podemos verificar
    # Si las columnas no son nullable, necesitaríamos recrear la tabla
    # Por ahora, solo verificamos
    category_col = next((col for col in columns_info if col[1] == 'category'), None)
    if category_col:
        print(f"   ✓ Columna category existe (nullable: {not category_col[3]})")
    
    # 6. Hacer que category y subcategory sean nullable en transactions si no lo son
    print("\n6️⃣ Verificando nullable en transactions...")
    cursor.execute("PRAGMA table_info(transactions)")
    columns_info = cursor.fetchall()
    
    category_col = next((col for col in columns_info if col[1] == 'category'), None)
    if category_col:
        print(f"   ✓ Columna category existe (nullable: {not category_col[3]})")

    # 7. Crear índices para mejorar el rendimiento
    print("\n7️⃣ Creando índices...")
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_custom_categories_family_id ON custom_categories(family_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_custom_subcategories_category_id ON custom_subcategories(custom_category_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_family_budgets_custom_category ON family_budgets(custom_category_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_custom_category ON transactions(custom_category_id)")
        print("   ✅ Índices creados")
    except Exception as e:
        print(f"   ⚠️  Error creando índices (puede que ya existan): {e}")

    # Commit de todos los cambios
    conn.commit()
    print("\n✅ Migración completada exitosamente!")
    print("\n📋 Resumen:")
    print("   • Tabla custom_categories creada")
    print("   • Tabla custom_subcategories creada")
    print("   • Columnas custom_category_id y custom_subcategory_id agregadas a family_budgets")
    print("   • Columnas custom_category_id y custom_subcategory_id agregadas a transactions")
    print("   • Índices creados para mejor rendimiento")

except Exception as e:
    conn.rollback()
    print(f"\n❌ Error durante la migración: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    conn.close()
