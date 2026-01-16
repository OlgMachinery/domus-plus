#!/usr/bin/env python3
"""
Script de migración para corregir los valores de transaction_type en la base de datos.
Convierte nombres de enum (EXPENSE, INCOME) a valores (expense, income).
"""
import sqlite3
import os
from pathlib import Path

# Ruta a la base de datos
db_path = Path(__file__).parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

print(f"📊 Corrigiendo valores de transaction_type en: {db_path}")

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar valores actuales
    cursor.execute("SELECT DISTINCT transaction_type FROM transactions")
    current_values = [row[0] for row in cursor.fetchall()]
    print(f"📋 Valores actuales en BD: {current_values}")
    
    # Mapeo de nombres de enum a valores
    enum_to_value = {
        'EXPENSE': 'expense',
        'INCOME': 'income',
        'expense': 'expense',  # Ya correcto
        'income': 'income'    # Ya correcto
    }
    
    updated_count = 0
    for enum_name, enum_value in enum_to_value.items():
        if enum_name in current_values and enum_name != enum_value:
            print(f"🔄 Actualizando '{enum_name}' -> '{enum_value}'...")
            cursor.execute(
                "UPDATE transactions SET transaction_type = ? WHERE transaction_type = ?",
                (enum_value, enum_name)
            )
            count = cursor.rowcount
            updated_count += count
            print(f"   ✅ {count} registros actualizados")
    
    conn.commit()
    
    # Verificar valores después de la migración
    cursor.execute("SELECT DISTINCT transaction_type FROM transactions")
    final_values = [row[0] for row in cursor.fetchall()]
    print(f"📋 Valores finales en BD: {final_values}")
    
    print(f"\n✅ Migración completada!")
    print(f"   Total de registros actualizados: {updated_count}")
    
except Exception as e:
    conn.rollback()
    print(f"\n❌ Error durante la migración: {str(e)}")
    exit(1)
finally:
    conn.close()
