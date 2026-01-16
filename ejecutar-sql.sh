#!/bin/bash

# Script para ejecutar SQL en Supabase usando curl

echo "🚀 Ejecutando SQL en Supabase..."
echo ""

cd "$(dirname "$0")"

# Cargar variables de entorno
if [ -f "frontend/.env.local" ]; then
    export $(grep -v '^#' frontend/.env.local | xargs)
else
    echo "❌ Error: No se encontró frontend/.env.local"
    exit 1
fi

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
    echo "❌ Error: Faltan variables de entorno"
    exit 1
fi

# Extraer project reference
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co|\1|')

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: No se pudo extraer el project reference"
    exit 1
fi

echo "📋 Project Reference: $PROJECT_REF"
echo ""

# Leer el SQL
SQL_FILE="supabase/schema.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Error: No se encontró $SQL_FILE"
    exit 1
fi

SQL_CONTENT=$(cat "$SQL_FILE")

echo "📄 SQL leído: $(wc -l < "$SQL_FILE") líneas"
echo ""

# Intentar ejecutar usando la API de Supabase
# Nota: Supabase no tiene un endpoint público para ejecutar SQL arbitrario
# Necesitamos usar el dashboard o el CLI

echo "⚠️  Supabase no permite ejecutar SQL arbitrario vía API REST pública"
echo ""
echo "💡 Opciones:"
echo ""
echo "OPCIÓN 1: Usar el Dashboard (Recomendado)"
echo "─────────────────────────────────────────"
echo "1. Ve a: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "2. Clic en 'SQL Editor' en el menú lateral"
echo "3. Clic en 'New Query'"
echo "4. Abre el archivo: $SQL_FILE"
echo "5. Copia TODO (Cmd+A, Cmd+C)"
echo "6. Pégalo en el editor (Cmd+V)"
echo "7. Clic en 'Run' (Cmd+Enter)"
echo ""

echo "OPCIÓN 2: Usar Supabase CLI"
echo "───────────────────────────"
echo "Si tienes el CLI instalado:"
echo "  supabase db push --db-url 'postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres' < $SQL_FILE"
echo ""

echo "OPCIÓN 3: Script Python/Node"
echo "─────────────────────────────"
echo "Puedo crear un script que use psycopg2 (Python) o pg (Node)"
echo "para conectarse directamente a PostgreSQL"
echo ""

# Verificar si hay Python con psycopg2
if command -v python3 &> /dev/null; then
    echo "✅ Python encontrado"
    echo "   Puedo crear un script Python para ejecutar el SQL"
fi

if command -v node &> /dev/null; then
    echo "✅ Node.js encontrado"
    echo "   Puedo crear un script Node.js para ejecutar el SQL"
fi

echo ""
echo "¿Qué opción prefieres? (1/2/3)"
