#!/usr/bin/env python3
"""
Script de migración para crear las tablas de recibos (receipts y receipt_items).
"""
import sqlite3
import os
from pathlib import Path

# Ruta a la base de datos
db_path = Path(__file__).parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

print(f"📊 Creando tablas de recibos en: {db_path}")

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    # Verificar si la tabla receipts ya existe
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='receipts'")
    receipts_exists = cursor.fetchone() is not None
    
    if not receipts_exists:
        print("🔄 Creando tabla receipts...")
        cursor.execute("""
            CREATE TABLE receipts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                image_url TEXT,
                whatsapp_message_id TEXT,
                whatsapp_phone TEXT,
                date TEXT,
                time TEXT,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'MXN',
                merchant_or_beneficiary TEXT,
                category TEXT,
                subcategory TEXT,
                concept TEXT,
                reference TEXT,
                operation_id TEXT,
                tracking_key TEXT,
                notes TEXT,
                status TEXT DEFAULT 'pending',
                assigned_transaction_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (assigned_transaction_id) REFERENCES transactions(id)
            )
        """)
        print("   ✅ Tabla receipts creada")
    else:
        print("✓ Tabla receipts ya existe")
    
    # Verificar si la tabla receipt_items ya existe
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='receipt_items'")
    items_exists = cursor.fetchone() is not None
    
    if not items_exists:
        print("🔄 Creando tabla receipt_items...")
        cursor.execute("""
            CREATE TABLE receipt_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id INTEGER NOT NULL,
                description TEXT NOT NULL,
                amount REAL NOT NULL,
                category TEXT,
                subcategory TEXT,
                assigned_transaction_id INTEGER,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_transaction_id) REFERENCES transactions(id)
            )
        """)
        print("   ✅ Tabla receipt_items creada")
    else:
        print("✓ Tabla receipt_items ya existe")
    
    conn.commit()
    print(f"\n✅ Migración completada!")
    
except Exception as e:
    conn.rollback()
    print(f"❌ Error durante la migración: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    conn.close()
