#!/usr/bin/env python3
"""
Migración: Agregar columna monthly_amounts a family_budgets
Esta columna almacenará los montos mensuales del presupuesto en formato JSON.
"""

import sqlite3
import json
import os

DB_PATH = 'domus_plus.db'

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"❌ Base de datos no encontrada: {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Verificar si la columna ya existe
        cursor.execute("PRAGMA table_info(family_budgets)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'monthly_amounts' in columns:
            print("✅ La columna monthly_amounts ya existe")
            return
        
        # Agregar la columna monthly_amounts como JSON (TEXT en SQLite)
        print("🔄 Agregando columna monthly_amounts...")
        cursor.execute("""
            ALTER TABLE family_budgets 
            ADD COLUMN monthly_amounts TEXT
        """)
        
        conn.commit()
        print("✅ Columna monthly_amounts agregada exitosamente")
        
        # Verificar que se agregó correctamente
        cursor.execute("PRAGMA table_info(family_budgets)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'monthly_amounts' in columns:
            print("✅ Verificación: columna monthly_amounts existe")
        else:
            print("❌ Error: la columna no se agregó correctamente")
            
    except Exception as e:
        conn.rollback()
        print(f"❌ Error durante la migración: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Iniciando migración: agregar monthly_amounts a family_budgets")
    migrate()
    print("✅ Migración completada")
