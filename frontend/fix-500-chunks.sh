#!/bin/bash
# Script para solucionar errores 500 en chunks de JavaScript de Next.js

echo "🔧 Solucionando errores 500 en chunks de JavaScript..."
echo ""

cd "$(dirname "$0")"

# Paso 1: Detener procesos
echo "1️⃣  Deteniendo procesos de Next.js..."
pkill -f "next dev" || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 2
echo "✅ Procesos detenidos"
echo ""

# Paso 2: Limpiar completamente
echo "2️⃣  Limpiando caché y builds..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf .turbo
echo "✅ Caché limpiado"
echo ""

# Paso 3: Verificar dependencias
echo "3️⃣  Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   Instalando dependencias..."
    npm install
else
    echo "   Dependencias ya instaladas"
fi
echo "✅ Dependencias verificadas"
echo ""

# Paso 4: Intentar compilar
echo "4️⃣  Compilando proyecto..."
if npm run build 2>&1 | tee /tmp/next-build.log; then
    echo "✅ Compilación exitosa"
else
    echo "❌ Error en la compilación. Revisa /tmp/next-build.log"
    echo ""
    echo "Errores encontrados:"
    grep -i "error\|failed\|cannot" /tmp/next-build.log | head -20
    exit 1
fi
echo ""

# Paso 5: Iniciar servidor
echo "5️⃣  Iniciando servidor de desarrollo..."
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Espera a ver 'Ready' en la terminal"
echo "   - Luego abre http://localhost:3000 en el navegador"
echo "   - Si ves errores, revisa la consola del navegador (F12)"
echo ""
npm run dev
