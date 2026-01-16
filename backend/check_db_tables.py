"""
Script para verificar qué tablas existen en la base de datos
"""
import sqlite3
from pathlib import Path

db_path = Path(__file__).parent.parent / "domus_plus.db"

if not db_path.exists():
    print(f"❌ Base de datos no encontrada en: {db_path}")
    exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    
    print(f"📊 Tablas en la base de datos ({db_path}):")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    for table in tables:
        print(f"   • {table[0]}")
        
        # Mostrar estructura de cada tabla
        cursor.execute(f"PRAGMA table_info({table[0]})")
        columns = cursor.fetchall()
        print(f"     Columnas: {', '.join([col[1] for col in columns])}")
        print()
        
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    conn.close()
