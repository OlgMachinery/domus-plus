#!/usr/bin/env python3
"""
Script de diagnóstico para verificar por qué el backend no inicia
"""

import sys
import os

print("🔍 Diagnóstico del Backend DOMUS+")
print("=" * 50)
print()

# 1. Verificar Python
print("1. Verificando Python...")
print(f"   Versión: {sys.version}")
print(f"   Ejecutable: {sys.executable}")
print()

# 2. Verificar directorio
print("2. Verificando directorio...")
print(f"   Directorio actual: {os.getcwd()}")
if os.path.exists("app/main.py"):
    print("   ✅ app/main.py encontrado")
else:
    print("   ❌ app/main.py NO encontrado")
    print("   Cambia al directorio backend/ antes de ejecutar")
    sys.exit(1)
print()

# 3. Verificar dependencias básicas
print("3. Verificando dependencias básicas...")
try:
    import fastapi
    print(f"   ✅ FastAPI: {fastapi.__version__}")
except ImportError as e:
    print(f"   ❌ FastAPI no instalado: {e}")
    print("   Ejecuta: pip install -r requirements.txt")

try:
    import sqlalchemy
    print(f"   ✅ SQLAlchemy: {sqlalchemy.__version__}")
except ImportError as e:
    print(f"   ❌ SQLAlchemy no instalado: {e}")

try:
    import uvicorn
    print(f"   ✅ Uvicorn: {uvicorn.__version__}")
except ImportError as e:
    print(f"   ❌ Uvicorn no instalado: {e}")
print()

# 4. Verificar importaciones del proyecto
print("4. Verificando importaciones del proyecto...")
try:
    from app.database import engine, Base
    print("   ✅ app.database")
except Exception as e:
    print(f"   ❌ Error en app.database: {e}")

try:
    from app import models
    print("   ✅ app.models")
except Exception as e:
    print(f"   ❌ Error en app.models: {e}")

try:
    from app import schemas
    print("   ✅ app.schemas")
except Exception as e:
    print(f"   ❌ Error en app.schemas: {e}")

try:
    from app.routers import users, families, budgets, transactions
    print("   ✅ Routers básicos (users, families, budgets, transactions)")
except Exception as e:
    print(f"   ❌ Error en routers básicos: {e}")

try:
    from app.routers import receipts
    print("   ✅ Router receipts")
except ImportError as e:
    print(f"   ⚠️  Router receipts no disponible (puede ser normal): {e}")
except Exception as e:
    print(f"   ❌ Error en router receipts: {e}")
    import traceback
    traceback.print_exc()
print()

# 5. Verificar main.py
print("5. Verificando app.main...")
try:
    from app.main import app
    print("   ✅ app.main importado correctamente")
    print(f"   ✅ FastAPI app creada: {app.title}")
except Exception as e:
    print(f"   ❌ Error al importar app.main: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
print()

# 6. Verificar base de datos
print("6. Verificando base de datos...")
try:
    from app.database import DATABASE_URL
    print(f"   URL: {DATABASE_URL}")
    if DATABASE_URL.startswith("sqlite"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            print(f"   ✅ Base de datos existe: {db_path}")
        else:
            print(f"   ⚠️  Base de datos no existe (se creará automáticamente): {db_path}")
except Exception as e:
    print(f"   ⚠️  Error verificando BD: {e}")
print()

# 7. Verificar variables de entorno
print("7. Verificando variables de entorno...")
env_file = ".env"
if os.path.exists(env_file):
    print(f"   ✅ Archivo .env encontrado")
    # No mostrar contenido por seguridad
else:
    print(f"   ⚠️  Archivo .env no encontrado (algunas funciones pueden no funcionar)")

openai_key = os.getenv("OPENAI_API_KEY")
if openai_key:
    print(f"   ✅ OPENAI_API_KEY configurada (longitud: {len(openai_key)} caracteres)")
else:
    print(f"   ⚠️  OPENAI_API_KEY no configurada (procesamiento de recibos no funcionará)")

secret_key = os.getenv("SECRET_KEY")
if secret_key and secret_key != "your-secret-key-here":
    print(f"   ✅ SECRET_KEY configurada")
else:
    print(f"   ⚠️  SECRET_KEY usando valor por defecto (no seguro para producción)")
print()

# 8. Resumen
print("=" * 50)
print("📊 RESUMEN")
print("=" * 50)
print()
print("Si todos los pasos anteriores muestran ✅, el backend debería iniciar correctamente.")
print()
print("Para iniciar el backend, ejecuta:")
print("  python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
print()
print("O usa el script:")
print("  ./iniciar_backend.sh")
print()
