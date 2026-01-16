#!/usr/bin/env python3
"""
Verifica qué paquetes están instalados en el venv
"""

import os
import sys

venv_site_packages = "venv/lib/python3.13/site-packages"

if not os.path.exists(venv_site_packages):
    print("❌ Entorno virtual no encontrado")
    sys.exit(1)

# Paquetes requeridos
required = [
    "fastapi",
    "uvicorn", 
    "sqlalchemy",
    "pydantic",
    "openai",
    "pytesseract",
    "twilio",
    "httpx",
    "python-dotenv",
    "python-jose",
    "passlib",
    "alembic"
]

print("🔍 Verificando paquetes instalados...")
print("=" * 50)
print()

installed = []
missing = []

for pkg in required:
    # Buscar el directorio o .dist-info
    found = False
    for item in os.listdir(venv_site_packages):
        if item.startswith(pkg.replace("-", "_")) or item.startswith(pkg):
            if os.path.isdir(os.path.join(venv_site_packages, item)) or item.endswith(".dist-info"):
                installed.append(pkg)
                found = True
                break
    if not found:
        missing.append(pkg)

print("✅ Paquetes instalados:")
for pkg in installed:
    print(f"   ✅ {pkg}")

print()
if missing:
    print("❌ Paquetes faltantes:")
    for pkg in missing:
        print(f"   ❌ {pkg}")
    print()
    print("Para instalar los faltantes, ejecuta:")
    print("  source venv/bin/activate")
    print("  pip install -r requirements.txt")
else:
    print("✅ ¡Todos los paquetes requeridos están instalados!")
    print()
    print("Para iniciar el backend:")
    print("  ./iniciar_backend.sh")
