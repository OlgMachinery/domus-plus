#!/usr/bin/env python3
"""
Script para inicializar la base de datos SQLite de DOMUS+
Ejecuta este script para crear todas las tablas necesarias.
"""

import os
import sys
from pathlib import Path

# Agregar el directorio actual al path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import engine, Base
from app import models

def init_database():
    """Crea todas las tablas en la base de datos"""
    print("🗄️  Inicializando base de datos SQLite...")
    
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    
    print("✅ Base de datos inicializada correctamente!")
    print(f"📁 Ubicación: {os.path.abspath('domus_plus.db')}")
    print("\nTablas creadas:")
    for table_name in Base.metadata.tables.keys():
        print(f"  - {table_name}")
    
    print("\n🎉 ¡Listo! Ahora puedes iniciar el servidor con:")
    print("   uvicorn app.main:app --reload")

if __name__ == "__main__":
    try:
        init_database()
    except Exception as e:
        print(f"❌ Error al inicializar la base de datos: {e}")
        sys.exit(1)

