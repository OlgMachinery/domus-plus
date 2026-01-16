#!/usr/bin/env python3
"""
Instalación directa de dependencias sin usar shell
"""

import subprocess
import sys
import os

# Cambiar al directorio del script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("🔧 Instalando dependencias del Backend DOMUS+")
print("=" * 50)
print()

# Verificar si existe entorno virtual
venv_python = os.path.join("venv", "bin", "python3")
if os.path.exists(venv_python):
    print("✅ Entorno virtual encontrado")
    python_exe = os.path.abspath(venv_python)
else:
    print("⚠️  Entorno virtual no encontrado, creando uno...")
    import venv
    venv.create("venv", with_pip=True)
    python_exe = os.path.abspath(venv_python)
    print("✅ Entorno virtual creado")

print(f"📁 Usando Python: {python_exe}")
print()

# Actualizar pip
print("📦 Actualizando pip...")
try:
    subprocess.run(
        [python_exe, "-m", "pip", "install", "--upgrade", "pip"],
        check=True
    )
    print("   ✅ pip actualizado")
except subprocess.CalledProcessError as e:
    print(f"   ⚠️  Advertencia al actualizar pip: {e}")
print()

# Instalar dependencias
print("📦 Instalando dependencias desde requirements.txt...")
try:
    result = subprocess.run(
        [python_exe, "-m", "pip", "install", "-r", "requirements.txt"],
        check=True,
        capture_output=True,
        text=True
    )
    print("   ✅ Dependencias instaladas correctamente")
    # Mostrar últimas líneas de la salida
    if result.stdout:
        lines = result.stdout.strip().split('\n')
        if len(lines) > 5:
            print("   ...")
            for line in lines[-5:]:
                print(f"   {line}")
        else:
            for line in lines:
                print(f"   {line}")
except subprocess.CalledProcessError as e:
    print(f"   ❌ Error al instalar dependencias")
    if e.stderr:
        print(f"   {e.stderr}")
    sys.exit(1)

print()
print("=" * 50)
print("✅ ¡Instalación completada exitosamente!")
print("=" * 50)
print()
print("Para iniciar el backend, ejecuta:")
print("  ./iniciar_backend.sh")
print()
