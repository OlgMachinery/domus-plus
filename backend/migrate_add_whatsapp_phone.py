#!/usr/bin/env python3
"""
Script de migración para agregar el campo whatsapp_phone a la tabla transactions.
Este campo almacenará el número de teléfono desde donde se envió el mensaje de WhatsApp.
"""
import sqlite3
import os
from pathlib import Path

# Ruta a la base de datos
db_path = Path(__file__).parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

print(f"📊 Agregando campo whatsapp_phone a transactions en: {db_path}")

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar si la columna ya existe
    cursor.execute("PRAGMA table_info(transactions)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'whatsapp_phone' in columns:
        print("✓ Columna 'whatsapp_phone' ya existe")
    else:
        print("🔄 Agregando columna 'whatsapp_phone'...")
        cursor.execute("ALTER TABLE transactions ADD COLUMN whatsapp_phone TEXT")
        print("   ✅ Columna agregada exitosamente")
    
    # Para transacciones existentes con whatsapp_message_id, intentar obtener el teléfono del usuario
    # Esto es opcional, pero puede ser útil para datos históricos
    cursor.execute("""
        SELECT t.id, u.phone 
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.whatsapp_message_id IS NOT NULL 
        AND t.whatsapp_phone IS NULL
    """)
    existing_transactions = cursor.fetchall()
    
    if existing_transactions:
        print(f"🔄 Actualizando {len(existing_transactions)} transacciones existentes con número de teléfono del usuario...")
        for trans_id, phone in existing_transactions:
            cursor.execute(
                "UPDATE transactions SET whatsapp_phone = ? WHERE id = ?",
                (phone, trans_id)
            )
        print(f"   ✅ {len(existing_transactions)} transacciones actualizadas")
    
    conn.commit()
    print(f"\n✅ Migración completada!")
    
except Exception as e:
    conn.rollback()
    print(f"\n❌ Error durante la migración: {str(e)}")
    import traceback
    print(traceback.format_exc())
    exit(1)
finally:
    conn.close()
