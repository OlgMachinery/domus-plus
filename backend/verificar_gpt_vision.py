#!/usr/bin/env python3
"""
Script para verificar que GPT-4 Vision está correctamente configurado
y puede procesar imágenes de recibos
"""
import os
import sys

print("🔍 Verificando configuración de GPT-4 Vision...\n")

# 1. Verificar que OpenAI está instalado
try:
    from openai import OpenAI
    print("✅ Biblioteca 'openai' instalada")
except ImportError:
    print("❌ Biblioteca 'openai' NO está instalada")
    print("   Instala con: pip install openai")
    sys.exit(1)

# 2. Verificar que el servicio de procesamiento está disponible
try:
    from app.services import receipt_processor
    print("✅ Servicio 'receipt_processor' disponible")
except ImportError as e:
    print(f"❌ Error al importar receipt_processor: {e}")
    sys.exit(1)

# 3. Verificar API Key
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    print(f"✅ OPENAI_API_KEY configurada (longitud: {len(api_key)} caracteres)")
    # Mostrar solo los primeros y últimos caracteres por seguridad
    masked_key = f"{api_key[:7]}...{api_key[-4:]}" if len(api_key) > 11 else "***"
    print(f"   Key: {masked_key}")
else:
    print("❌ OPENAI_API_KEY NO está configurada")
    print("   Configura la variable de entorno:")
    print("   export OPENAI_API_KEY='tu-api-key-aqui'")
    print("   O agrega al archivo .env:")
    print("   OPENAI_API_KEY=tu-api-key-aqui")

# 4. Verificar que el cliente está inicializado
if receipt_processor.OPENAI_AVAILABLE:
    print("✅ OpenAI está disponible en el módulo")
    
    if receipt_processor.client:
        print("✅ Cliente OpenAI inicializado correctamente")
        print(f"   Modelos disponibles: gpt-4o, gpt-4-turbo (fallback)")
    else:
        print("⚠️  Cliente OpenAI NO está inicializado (falta API key)")
else:
    print("❌ OpenAI NO está disponible en el módulo")

# 5. Verificar el endpoint de procesamiento
print("\n📋 Endpoints disponibles:")
print("   - POST /api/receipts/process - Procesar recibo subido manualmente")
print("   - POST /api/whatsapp/webhook - Procesar recibo desde WhatsApp")

# 6. Resumen
print("\n" + "="*60)
if api_key and receipt_processor.OPENAI_AVAILABLE and receipt_processor.client:
    print("✅ GPT-4 Vision está COMPLETAMENTE CONFIGURADO")
    print("\n💡 Cómo usar:")
    print("   1. Sube una imagen de recibo a /api/receipts/process")
    print("   2. O envía una imagen por WhatsApp al webhook")
    print("   3. El sistema extraerá automáticamente:")
    print("      - Fecha y hora")
    print("      - Monto")
    print("      - Comercio/beneficiario")
    print("      - Categoría y subcategoría")
    print("      - Concepto, referencia, etc.")
else:
    print("⚠️  GPT-4 Vision NO está completamente configurado")
    if not api_key:
        print("\n   Acción requerida: Configurar OPENAI_API_KEY")
    if not receipt_processor.client:
        print("\n   Acción requerida: Inicializar cliente OpenAI")
print("="*60)
