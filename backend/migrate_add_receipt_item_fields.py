#!/usr/bin/env python3
"""
Script de migración para agregar campos quantity, unit_price y unit_of_measure a receipt_items.
"""
import sqlite3
import os
from pathlib import Path

# Ruta a la base de datos
db_path = Path(__file__).parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

print(f"📊 Agregando columnas a receipt_items en: {db_path}")

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar columnas existentes
    cursor.execute("PRAGMA table_info(receipt_items)")
    columns = [row[1] for row in cursor.fetchall()]
    print(f"Columnas actuales: {columns}")
    
    # Agregar quantity si no existe
    if 'quantity' not in columns:
        print("🔄 Agregando columna quantity...")
        cursor.execute("ALTER TABLE receipt_items ADD COLUMN quantity REAL")
        print("   ✅ Columna quantity agregada")
    else:
        print("✓ Columna quantity ya existe")
    
    # Agregar unit_price si no existe
    if 'unit_price' not in columns:
        print("🔄 Agregando columna unit_price...")
        cursor.execute("ALTER TABLE receipt_items ADD COLUMN unit_price REAL")
        print("   ✅ Columna unit_price agregada")
    else:
        print("✓ Columna unit_price ya existe")
    
    # Agregar unit_of_measure si no existe
    if 'unit_of_measure' not in columns:
        print("🔄 Agregando columna unit_of_measure...")
        cursor.execute("ALTER TABLE receipt_items ADD COLUMN unit_of_measure TEXT")
        print("   ✅ Columna unit_of_measure agregada")
    else:
        print("✓ Columna unit_of_measure ya existe")
    
    conn.commit()
    print(f"\n✅ Migración completada!")
    
    # Verificar columnas finales
    cursor.execute("PRAGMA table_info(receipt_items)")
    final_columns = [row[1] for row in cursor.fetchall()]
    print(f"Columnas finales: {final_columns}")
    
except Exception as e:
    conn.rollback()
    print(f"❌ Error durante la migración: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    conn.close()
