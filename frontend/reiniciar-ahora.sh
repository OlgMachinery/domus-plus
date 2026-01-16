#!/bin/bash

echo "🔄 Reiniciando servidor Next.js..."

# Ir al directorio frontend
cd "$(dirname "$0")"

# Limpiar caché
echo "🧹 Limpiando caché..."
rm -rf .next
rm -rf node_modules/.cache

# Verificar variables de entorno
if [ ! -f .env.local ]; then
  echo "⚠️  ADVERTENCIA: .env.local no encontrado"
  echo "   Crea el archivo con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY"
else
  echo "✅ Variables de entorno encontradas"
fi

# Iniciar servidor
echo "🚀 Iniciando servidor..."
npm run dev
