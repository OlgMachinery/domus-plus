#!/usr/bin/env python3
"""
Script Python para instalar dependencias del backend DOMUS+
Ejecuta: python3 instalar_dependencias.py
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Ejecuta un comando y muestra el progreso"""
    print(f"📦 {description}...")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=True,
            capture_output=True,
            text=True
        )
        print(f"   ✅ {description} completado")
        if result.stdout:
            print(f"   {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"   ❌ Error: {e}")
        if e.stderr:
            print(f"   {e.stderr.strip()}")
        return False

def main():
    print("🔧 Instalando dependencias del Backend DOMUS+")
    print("=" * 50)
    print()
    
    # Cambiar al directorio del script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    print(f"📁 Directorio: {script_dir}")
    print()
    
    # Verificar que requirements.txt existe
    if not os.path.exists("requirements.txt"):
        print("❌ Error: requirements.txt no encontrado")
        sys.exit(1)
    
    # Verificar si existe entorno virtual
    venv_python = os.path.join("venv", "bin", "python3")
    if os.path.exists(venv_python):
        print("✅ Entorno virtual encontrado")
        python_cmd = venv_python
        pip_cmd = os.path.join("venv", "bin", "pip")
    else:
        print("⚠️  Entorno virtual no encontrado, usando Python del sistema")
        python_cmd = "python3"
        pip_cmd = "pip3"
    
    print()
    
    # Actualizar pip
    if not run_command(f"{pip_cmd} install --upgrade pip", "Actualizando pip"):
        print("⚠️  Advertencia: No se pudo actualizar pip, continuando...")
    
    print()
    
    # Instalar dependencias
    if not run_command(f"{pip_cmd} install -r requirements.txt", "Instalando dependencias"):
        print("❌ Error al instalar dependencias")
        sys.exit(1)
    
    print()
    print("=" * 50)
    print("✅ ¡Instalación completada exitosamente!")
    print("=" * 50)
    print()
    print("Para iniciar el backend, ejecuta:")
    print("  ./iniciar_backend.sh")
    print()
    print("O manualmente:")
    if os.path.exists(venv_python):
        print("  source venv/bin/activate")
    print("  python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
    print()

if __name__ == "__main__":
    main()
