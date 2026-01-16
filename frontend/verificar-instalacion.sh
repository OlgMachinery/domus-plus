#!/bin/bash

# Script para verificar la instalación de Supabase

echo "🔍 Verificando instalación de Supabase..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json. Ejecuta este script desde el directorio frontend/"
    exit 1
fi

echo "✅ Directorio correcto"
echo ""

# Verificar dependencias de Supabase
echo "📦 Verificando dependencias..."
if grep -q "@supabase/supabase-js" package.json; then
    echo "✅ @supabase/supabase-js encontrado en package.json"
else
    echo "❌ @supabase/supabase-js NO encontrado. Ejecuta: npm install"
fi

if grep -q "@supabase/ssr" package.json; then
    echo "✅ @supabase/ssr encontrado en package.json"
else
    echo "❌ @supabase/ssr NO encontrado. Ejecuta: npm install"
fi

echo ""

# Verificar archivos de Supabase
echo "📁 Verificando archivos de Supabase..."
if [ -f "lib/supabase/client.ts" ]; then
    echo "✅ lib/supabase/client.ts existe"
else
    echo "❌ lib/supabase/client.ts NO existe"
fi

if [ -f "lib/supabase/server.ts" ]; then
    echo "✅ lib/supabase/server.ts existe"
else
    echo "❌ lib/supabase/server.ts NO existe"
fi

if [ -f "lib/supabase/middleware.ts" ]; then
    echo "✅ lib/supabase/middleware.ts existe"
else
    echo "❌ lib/supabase/middleware.ts NO existe"
fi

if [ -f "middleware.ts" ]; then
    echo "✅ middleware.ts existe"
else
    echo "❌ middleware.ts NO existe"
fi

echo ""

# Verificar variables de entorno
echo "🔐 Verificando variables de entorno..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local existe"
    
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
        echo "✅ NEXT_PUBLIC_SUPABASE_URL configurada"
    else
        echo "⚠️  NEXT_PUBLIC_SUPABASE_URL NO configurada"
    fi
    
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local; then
        echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada"
    else
        echo "⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY NO configurada"
    fi
else
    echo "⚠️  .env.local NO existe. Crea este archivo con tus variables de Supabase"
    echo "   Puedes usar .env.example como referencia"
fi

echo ""

# Verificar API Routes
echo "🛣️  Verificando API Routes..."
if [ -d "app/api/auth/login" ]; then
    echo "✅ app/api/auth/login existe"
else
    echo "❌ app/api/auth/login NO existe"
fi

if [ -d "app/api/auth/register" ]; then
    echo "✅ app/api/auth/register existe"
else
    echo "❌ app/api/auth/register NO existe"
fi

if [ -d "app/api/users/me" ]; then
    echo "✅ app/api/users/me existe"
else
    echo "❌ app/api/users/me NO existe"
fi

echo ""
echo "✨ Verificación completada!"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Si faltan dependencias: npm install"
echo "   2. Configura .env.local con tus keys de Supabase"
echo "   3. Ejecuta el esquema SQL en Supabase (ver PASOS_MIGRACION.md)"
echo "   4. Inicia el servidor: npm run dev"
