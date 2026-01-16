#!/usr/bin/env python3
"""
Script para ejecutar SQL en Supabase usando psycopg2
Requiere: pip install psycopg2-binary
"""

import os
import sys
import re
from pathlib import Path

# Cargar variables de entorno
env_file = Path(__file__).parent / "frontend" / ".env.local"
if not env_file.exists():
    print("❌ Error: No se encontró frontend/.env.local")
    sys.exit(1)

# Leer .env.local
env_vars = {}
with open(env_file) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_vars[key.strip()] = value.strip()

SUPABASE_URL = env_vars.get('NEXT_PUBLIC_SUPABASE_URL')
SERVICE_KEY = env_vars.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ Error: Faltan variables de entorno")
    sys.exit(1)

# Extraer project reference
match = re.search(r'https://([^.]+)\.supabase\.co', SUPABASE_URL)
if not match:
    print("❌ Error: URL de Supabase inválida")
    sys.exit(1)

PROJECT_REF = match.group(1)

print("🚀 Ejecutando SQL en Supabase...")
print(f"   Project: {PROJECT_REF}")
print("")

# Leer el SQL
sql_file = Path(__file__).parent / "supabase" / "schema.sql"
if not sql_file.exists():
    print(f"❌ Error: No se encontró {sql_file}")
    sys.exit(1)

with open(sql_file) as f:
    sql_content = f.read()

print(f"📄 SQL leído: {len(sql_content.splitlines())} líneas")
print("")

# Intentar importar psycopg2
try:
    import psycopg2
    from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
except ImportError:
    print("❌ Error: psycopg2 no está instalado")
    print("   Instala con: pip install psycopg2-binary")
    print("")
    print("💡 Alternativa: Ejecuta el SQL manualmente en el dashboard")
    print(f"   1. Ve a: https://supabase.com/dashboard/project/{PROJECT_REF}")
    print("   2. SQL Editor → New Query")
    print("   3. Copia el contenido de: supabase/schema.sql")
    sys.exit(1)

# Necesitamos la contraseña de la base de datos
# La obtenemos del usuario o la pedimos
print("⚠️  Para conectarse a PostgreSQL necesitamos la Database Password")
print("   (La que configuraste al crear el proyecto)")
print("")
db_password = input("Database Password: ").strip()

if not db_password:
    print("❌ Error: Password requerido")
    sys.exit(1)

# Construir connection string
# El formato de Supabase es: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
conn_string = f"postgresql://postgres:{db_password}@db.{PROJECT_REF}.supabase.co:5432/postgres"

try:
    print("🔌 Conectando a la base de datos...")
    conn = psycopg2.connect(conn_string)
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    print("✅ Conectado!")
    print("📤 Ejecutando SQL...")
    print("")
    
    # Ejecutar el SQL (puede tener múltiples statements)
    cursor.execute(sql_content)
    
    print("✅ SQL ejecutado exitosamente!")
    print("")
    print("📊 Verificando tablas creadas...")
    
    # Verificar que las tablas se crearon
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    
    tables = cursor.fetchall()
    if tables:
        print(f"   ✅ {len(tables)} tablas encontradas:")
        for table in tables[:10]:  # Mostrar primeras 10
            print(f"      - {table[0]}")
        if len(tables) > 10:
            print(f"      ... y {len(tables) - 10} más")
    else:
        print("   ⚠️  No se encontraron tablas")
    
    cursor.close()
    conn.close()
    
    print("")
    print("🎉 ¡Base de datos configurada exitosamente!")
    
except psycopg2.OperationalError as e:
    print(f"❌ Error de conexión: {e}")
    print("")
    print("💡 Verifica:")
    print("   - Que la contraseña sea correcta")
    print("   - Que el proyecto esté activo en Supabase")
    print("   - Que la conexión a la base de datos esté habilitada")
    sys.exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
