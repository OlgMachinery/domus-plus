#!/bin/bash

echo "🔧 SOLUCIÓN COMPLETA - DOMUS+ Frontend"
echo "======================================"
echo ""

cd "$(dirname "$0")"

# 1. Detener todos los procesos
echo "1️⃣ Deteniendo procesos..."
for port in 3000 3001 3002 3003 3004 3005 3006 3007; do
    PID=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        kill -9 $PID 2>/dev/null
        echo "   ✅ Puerto $port liberado"
    fi
done
sleep 2
echo ""

# 2. Limpiar TODO
echo "2️⃣ Limpiando caché y archivos temporales..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
echo "   ✅ Caché limpiado"
echo ""

# 3. Verificar package.json
echo "3️⃣ Verificando dependencias..."
if ! grep -q '"openai"' package.json; then
    echo "   ⚠️  Agregando openai a package.json..."
    # Usar sed para agregar openai antes del cierre de dependencies
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's/"zustand": "^4.4.7"/"zustand": "^4.4.7",\
    "openai": "^4.20.0"/' package.json
    else
        # Linux
        sed -i 's/"zustand": "^4.4.7"/"zustand": "^4.4.7",\n    "openai": "^4.20.0"/' package.json
    fi
    echo "   ✅ openai agregado"
fi
echo ""

# 4. Instalar dependencias
echo "4️⃣ Instalando dependencias..."
echo "   Esto puede tardar unos minutos..."
npm install
if [ $? -ne 0 ]; then
    echo "   ❌ Error al instalar dependencias"
    echo "   Intenta manualmente: npm install"
    exit 1
fi
echo "   ✅ Dependencias instaladas"
echo ""

# 5. Verificar .env.local
echo "5️⃣ Verificando configuración..."
if [ ! -f ".env.local" ]; then
    echo "   ⚠️  .env.local no existe"
    echo "   Crea el archivo con tus credenciales de Supabase"
else
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local && ! grep -q "NEXT_PUBLIC_SUPABASE_URL=$" .env.local; then
        echo "   ✅ NEXT_PUBLIC_SUPABASE_URL configurada"
    else
        echo "   ⚠️  NEXT_PUBLIC_SUPABASE_URL no configurada"
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local && ! grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=$" .env.local; then
        echo "   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada"
    else
        echo "   ⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY no configurada"
    fi
fi
echo ""

# 6. Iniciar servidor
echo "6️⃣ Iniciando servidor..."
echo ""
echo "🚀 El servidor se iniciará en http://localhost:3000"
echo "   Espera a ver 'Ready' antes de usar la aplicación"
echo "   Presiona Ctrl+C para detener"
echo ""
echo "======================================"
echo ""

npm run dev
