#!/bin/bash

echo "🔧 Solucionando problemas de permisos con Next.js..."
echo ""

cd "$(dirname "$0")"

# Detener servidor
echo "1️⃣  Deteniendo servidor..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2
echo "✅ Servidor detenido"
echo ""

# Limpiar caché
echo "2️⃣  Limpiando caché..."
rm -rf .next
rm -rf node_modules/.cache
echo "✅ Caché limpiado"
echo ""

# Corregir permisos de node_modules
echo "3️⃣  Corrigiendo permisos de node_modules..."
chmod -R u+rw node_modules 2>/dev/null || echo "⚠️  Algunos permisos no se pudieron cambiar"
echo "✅ Permisos corregidos"
echo ""

# Reinstalar Next.js específicamente
echo "4️⃣  Reinstalando Next.js..."
npm uninstall next
npm install next@14.0.3
echo "✅ Next.js reinstalado"
echo ""

# Verificar permisos del archivo problemático
echo "5️⃣  Verificando archivo problemático..."
if [ -f "node_modules/next/dist/client/components/router-reducer/create-href-from-url.js" ]; then
    chmod u+r "node_modules/next/dist/client/components/router-reducer/create-href-from-url.js"
    echo "✅ Permisos del archivo corregidos"
else
    echo "⚠️  Archivo no encontrado, puede que Next.js no se instaló correctamente"
fi
echo ""

# Iniciar servidor
echo "6️⃣  Iniciando servidor..."
echo ""
echo "💡 IMPORTANTE:"
echo "   - Espera a ver 'Ready' en la terminal"
echo "   - Luego abre http://localhost:3000 en el navegador"
echo "   - Si el problema persiste, puede ser un problema del sistema operativo"
echo ""

npm run dev
