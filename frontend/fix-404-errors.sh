#!/bin/bash

echo "🔧 Solucionando errores 404 de Next.js..."
echo ""

cd "$(dirname "$0")"

# Paso 1: Detener cualquier proceso de Next.js
echo "1️⃣ Deteniendo procesos de Next.js..."
pkill -f "next dev" || true
sleep 2

# Paso 2: Limpiar caché y build
echo "2️⃣ Limpiando caché y build..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .swc

# Paso 3: Verificar variables de entorno
echo "3️⃣ Verificando variables de entorno..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  Archivo .env.local no encontrado"
    echo "   Crea el archivo con:"
    echo "   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co"
    echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key"
    echo ""
    read -p "¿Continuar de todos modos? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Paso 4: Reinstalar dependencias (opcional)
echo "4️⃣ Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "   Instalando dependencias..."
    npm install
else
    echo "   ✅ Dependencias encontradas"
fi

# Paso 5: Reconstruir
echo "5️⃣ Reconstruyendo proyecto..."
npm run build 2>&1 | head -50

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build exitoso!"
    echo ""
    echo "6️⃣ Iniciando servidor de desarrollo..."
    echo ""
    echo "🚀 Servidor iniciado. Abre http://localhost:3000 en tu navegador"
    echo ""
    npm run dev
else
    echo ""
    echo "❌ Error en el build. Revisa los errores arriba."
    echo ""
    echo "Intenta manualmente:"
    echo "  npm install"
    echo "  npm run dev"
    exit 1
fi
