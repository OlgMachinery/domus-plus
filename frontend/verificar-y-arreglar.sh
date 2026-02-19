#!/bin/bash

echo "🔍 Verificando y Arreglando Next.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$(dirname "$0")"

# Verificar directorio
if [ ! -f "package.json" ]; then
    echo "❌ Error: No estás en el directorio frontend/"
    echo "   Ejecuta: cd ~/domus-plus/frontend"
    exit 1
fi

echo "✅ Directorio: $(pwd)"
echo ""

# Verificar si el servidor está corriendo
echo "1️⃣ Verificando si el servidor está corriendo..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    PID=$(lsof -ti :3000)
    echo "   ⚠️  Servidor corriendo en puerto 3000 (PID: $PID)"
    echo "   Deteniendo..."
    kill -9 $PID 2>/dev/null || true
    sleep 2
    echo "   ✅ Servidor detenido"
else
    echo "   ✅ Puerto 3000 libre"
fi
echo ""

# Detener cualquier otro proceso de Next.js
echo "2️⃣ Deteniendo procesos de Next.js..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1
echo "   ✅ Procesos detenidos"
echo ""

# Limpiar
echo "3️⃣ Limpiando caché y builds..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf .turbo
echo "   ✅ Limpieza completada"
echo ""

# Verificar node_modules
echo "4️⃣ Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   📦 Instalando dependencias..."
    npm install
else
    echo "   ✅ node_modules existe"
fi
echo ""

# Verificar .env.local
echo "5️⃣ Verificando variables de entorno..."
if [ ! -f ".env.local" ]; then
    echo "   ⚠️  .env.local NO existe"
    echo ""
    echo "   Crea el archivo .env.local con:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key"
    echo ""
else
    echo "   ✅ .env.local existe"
    if ! grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
        echo "   ⚠️  NEXT_PUBLIC_SUPABASE_URL no encontrada en .env.local"
    else
        echo "   ✅ NEXT_PUBLIC_SUPABASE_URL configurada"
    fi
fi
echo ""

# Intentar build
echo "6️⃣ Compilando proyecto..."
echo "   (Esto puede tomar 1-2 minutos...)"
echo ""

BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "   ✅ Build exitoso!"
    echo ""
else
    echo ""
    echo "   ❌ Error en el build"
    echo ""
    echo "   Errores encontrados:"
    echo "$BUILD_OUTPUT" | grep -i "error" | head -10
    echo ""
    echo "   ⚠️  El servidor puede no funcionar correctamente"
    echo ""
    read -p "   ¿Continuar de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "   Corrige los errores y vuelve a intentar."
        exit 1
    fi
fi

# Iniciar servidor
echo ""
echo "7️⃣ Iniciando servidor..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Servidor iniciando en: http://localhost:3000"
echo ""
echo "  ⚠️  IMPORTANTE:"
echo "  1. Espera a ver '✓ Ready' en la terminal"
echo "  2. Luego espera 5-10 segundos más"
echo "  3. Solo entonces abre http://localhost:3000 en el navegador"
echo "  4. Si ves errores, espera 15 segundos y recarga (Ctrl+R)"
echo ""
echo "  📝 Presiona Ctrl+C para detener el servidor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
