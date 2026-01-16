#!/usr/bin/env python3
"""Script para crear todas las tablas de la base de datos"""
import sys
from pathlib import Path

# Agregar el directorio actual al path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import engine, Base
from app import models  # Importar todos los modelos

print("🔧 Creando todas las tablas en la base de datos...")
print("")

try:
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    print("✅ Todas las tablas creadas exitosamente!")
    print("")
    print("📋 Tablas creadas:")
    for table_name in Base.metadata.tables.keys():
        print(f"   - {table_name}")
    
except Exception as e:
    print(f"❌ Error al crear tablas: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("")
print("✅ Proceso completado")
