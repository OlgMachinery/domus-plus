#!/usr/bin/env python3
"""
Script simple para crear la base de datos SQLite
Ejecuta: python3 crear_bd.py
"""

import sys
import os

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from app.database import engine, Base
    from app import models
    
    print("🗄️  Creando base de datos SQLite...")
    print("")
    
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    
    # Verificar que se creó
    db_path = os.path.join(os.path.dirname(__file__), "domus_plus.db")
    if os.path.exists(db_path):
        size = os.path.getsize(db_path)
        print(f"✅ Base de datos creada exitosamente!")
        print(f"📁 Ubicación: {os.path.abspath(db_path)}")
        print(f"📊 Tamaño: {size} bytes")
        print("")
        print("Tablas creadas:")
        for table_name in sorted(Base.metadata.tables.keys()):
            print(f"  ✓ {table_name}")
        print("")
        print("🎉 ¡Listo! Ahora puedes iniciar el servidor:")
        print("   uvicorn app.main:app --reload")
    else:
        print("⚠️  La base de datos debería haberse creado, pero no se encontró el archivo.")
        print("   Verifica la configuración en .env")
        
except ImportError as e:
    print("❌ Error: No se pudieron importar los módulos necesarios.")
    print("   Asegúrate de que:")
    print("   1. Estás en el directorio backend/")
    print("   2. Has activado el entorno virtual: source venv/bin/activate")
    print("   3. Has instalado las dependencias: pip install -r requirements.txt")
    print("")
    print(f"   Error específico: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error al crear la base de datos: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

