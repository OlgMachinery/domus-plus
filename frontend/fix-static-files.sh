#!/bin/bash

echo "🔧 Solucionando errores 404 de archivos estáticos de Next.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$(dirname "$0")"

# Verificar directorio
if [ ! -f "package.json" ]; then
    echo "❌ Error: No estás en el directorio frontend/"
    exit 1
fi

echo "✅ Directorio: $(pwd)"
echo ""

# Paso 1: Detener servidor
echo "1️⃣ Deteniendo servidor..."
pkill -f "next dev" 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 2
echo "   ✅ Servidor detenido"
echo ""

# Paso 2: Limpiar completamente
echo "2️⃣ Limpiando builds y caché..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf .turbo
echo "   ✅ Limpieza completada"
echo ""

# Paso 3: Verificar dependencias
echo "3️⃣ Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   📦 Instalando dependencias..."
    npm install
else
    echo "   ✅ Dependencias OK"
fi
echo ""

# Paso 4: Compilar
echo "4️⃣ Compilando proyecto (esto puede tomar 1-2 minutos)..."
echo ""

if npm run build 2>&1 | tee /tmp/nextjs-build.log; then
    echo ""
    echo "   ✅ Compilación exitosa!"
    echo ""
    
    # Verificar que .next existe
    if [ -d ".next" ]; then
        echo "   ✅ Carpeta .next generada correctamente"
        
        # Verificar archivos estáticos
        if [ -d ".next/static" ]; then
            echo "   ✅ Carpeta .next/static existe"
            STATIC_COUNT=$(find .next/static -type f 2>/dev/null | wc -l | tr -d ' ')
            echo "   ✅ Encontrados $STATIC_COUNT archivos estáticos"
        else
            echo "   ⚠️  Carpeta .next/static no encontrada"
        fi
    else
        echo "   ❌ Carpeta .next no se generó"
        echo "   Revisa los errores de compilación arriba"
        exit 1
    fi
else
    echo ""
    echo "   ❌ Error en la compilación"
    echo ""
    echo "   Últimas líneas del log:"
    tail -30 /tmp/nextjs-build.log
    echo ""
    echo "   Corrige los errores y vuelve a intentar."
    exit 1
fi

echo ""

# Paso 5: Iniciar servidor
echo "5️⃣ Iniciando servidor de desarrollo..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Servidor iniciando..."
echo ""
echo "  ⚠️  IMPORTANTE:"
echo "  1. Espera a ver '✓ Ready' en la terminal"
echo "  2. Espera 10 segundos adicionales"
echo "  3. Abre http://localhost:3000 en el navegador"
echo "  4. Si ves errores, espera 15 segundos y recarga (Ctrl+R)"
echo ""
echo "  📝 Presiona Ctrl+C para detener"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
