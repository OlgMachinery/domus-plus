#!/bin/bash

echo "🔧 Solución Completa para Error 404 y 'missing required error components'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ir al directorio del proyecto
cd "$(dirname "$0")"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json"
    echo "   Asegúrate de estar en el directorio frontend/"
    exit 1
fi

echo "✅ Directorio correcto: $(pwd)"
echo ""

# Paso 1: Detener cualquier proceso de Next.js
echo "1️⃣ Deteniendo procesos de Next.js..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2
echo "   ✅ Procesos detenidos"
echo ""

# Paso 2: Verificar que el puerto 3000 está libre
echo "2️⃣ Verificando puerto 3000..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "   ⚠️  Puerto 3000 está en uso"
    echo "   Deteniendo proceso..."
    lsof -ti :3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi
echo "   ✅ Puerto 3000 libre"
echo ""

# Paso 3: Limpiar TODO
echo "3️⃣ Limpiando caché y builds anteriores..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc
rm -rf .turbo
echo "   ✅ Limpieza completada"
echo ""

# Paso 4: Verificar dependencias
echo "4️⃣ Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   📦 Instalando dependencias..."
    npm install
else
    echo "   ✅ Dependencias encontradas"
fi
echo ""

# Paso 5: Verificar variables de entorno
echo "5️⃣ Verificando variables de entorno..."
if [ ! -f ".env.local" ]; then
    echo "   ⚠️  ADVERTENCIA: No se encontró .env.local"
    echo ""
    echo "   Crea el archivo .env.local con:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key"
    echo ""
    read -p "   ¿Continuar de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "   ✅ Archivo .env.local encontrado"
fi
echo ""

# Paso 6: Intentar build
echo "6️⃣ Intentando compilar el proyecto..."
echo "   (Esto puede tomar unos minutos...)"
echo ""

if npm run build 2>&1 | tee /tmp/nextjs-build.log; then
    echo ""
    echo "   ✅ Build exitoso!"
    echo ""
else
    echo ""
    echo "   ❌ Error en el build"
    echo ""
    echo "   Revisa los errores arriba. Errores comunes:"
    echo "   - Module not found: ejecuta 'npm install'"
    echo "   - Type errors: revisa los archivos TypeScript"
    echo "   - Syntax errors: revisa la sintaxis del código"
    echo ""
    echo "   Últimas líneas del log:"
    tail -20 /tmp/nextjs-build.log
    echo ""
    read -p "   ¿Intentar iniciar el servidor de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Paso 7: Iniciar servidor
echo ""
echo "7️⃣ Iniciando servidor de desarrollo..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Servidor iniciado en: http://localhost:3000"
echo "  📝 Presiona Ctrl+C para detener el servidor"
echo "  ⏳ Espera a ver 'Ready' antes de abrir el navegador"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
