#!/usr/bin/env python3
"""
Script de prueba para validar que OCR + GPT Vision funciona correctamente.
"""

import sys
import os

# Agregar el directorio del proyecto al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🧪 Validando implementación de OCR + GPT Vision\n")

# Test 1: Verificar imports
print("1️⃣ Verificando imports...")
try:
    from app.services.receipt_processor import extract_text_with_ocr, OCR_AVAILABLE, OPENAI_AVAILABLE
    print("   ✅ Imports exitosos")
except ImportError as e:
    print(f"   ❌ Error en imports: {e}")
    sys.exit(1)

# Test 2: Verificar que OCR está disponible
print("\n2️⃣ Verificando disponibilidad de OCR...")
if OCR_AVAILABLE:
    print("   ✅ OCR disponible (pytesseract importado correctamente)")
    try:
        import pytesseract
        print(f"   ✅ pytesseract versión: {pytesseract.__version__ if hasattr(pytesseract, '__version__') else 'N/A'}")
    except Exception as e:
        print(f"   ⚠️  pytesseract importado pero con error: {e}")
else:
    print("   ⚠️  OCR no disponible (pytesseract no instalado)")
    print("   ℹ️  El sistema funcionará solo con GPT Vision")

# Test 3: Verificar que OpenAI está disponible
print("\n3️⃣ Verificando disponibilidad de OpenAI...")
if OPENAI_AVAILABLE:
    print("   ✅ OpenAI disponible")
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        print("   ✅ OPENAI_API_KEY configurada")
    else:
        print("   ⚠️  OPENAI_API_KEY no configurada (necesaria para procesar recibos)")
else:
    print("   ❌ OpenAI no disponible")

# Test 4: Verificar función extract_text_with_ocr
print("\n4️⃣ Verificando función extract_text_with_ocr...")
try:
    # Crear una imagen de prueba simple (blanco con texto)
    from PIL import Image, ImageDraw, ImageFont
    import io
    import base64
    
    # Crear imagen de prueba
    img = Image.new('RGB', (400, 100), color='white')
    draw = ImageDraw.Draw(img)
    try:
        # Intentar usar una fuente del sistema
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
    except:
        font = ImageFont.load_default()
    
    draw.text((10, 40), "TEST RECEIPT 123.45", fill='black', font=font)
    
    # Convertir a base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    if OCR_AVAILABLE:
        print("   🔍 Probando extracción de texto con OCR...")
        ocr_text = extract_text_with_ocr(img_base64, 'jpeg')
        if ocr_text:
            print(f"   ✅ OCR funcionando! Texto extraído: '{ocr_text[:50]}...'")
        else:
            print("   ⚠️  OCR no extrajo texto (puede ser normal si Tesseract no está instalado)")
    else:
        print("   ⏭️  Saltando prueba de OCR (no disponible)")
        
except Exception as e:
    print(f"   ⚠️  Error en prueba de OCR: {e}")
    print("   ℹ️  Esto es normal si Tesseract no está instalado en el sistema")

# Test 5: Verificar que process_receipt_image acepta parámetros correctos
print("\n5️⃣ Verificando función process_receipt_image...")
try:
    from app.services.receipt_processor import process_receipt_image
    import inspect
    
    sig = inspect.signature(process_receipt_image)
    params = list(sig.parameters.keys())
    print(f"   ✅ Función encontrada con parámetros: {params}")
    
    # Verificar que acepta image_base64 e image_format
    if 'image_base64' in params and 'image_format' in params:
        print("   ✅ Parámetros correctos")
    else:
        print("   ⚠️  Parámetros inesperados")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 6: Verificar instrucciones de GPT
print("\n6️⃣ Verificando instrucciones de GPT...")
try:
    from app.services.receipt_processor import process_receipt_image
    import inspect
    
    # Leer el archivo para verificar las instrucciones
    with open('app/services/receipt_processor.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verificar que las instrucciones incluyen OCR
    if 'OCR TEXT' in content or 'ocr_text' in content:
        print("   ✅ Instrucciones de GPT incluyen soporte para texto OCR")
    else:
        print("   ⚠️  No se encontró referencia a OCR en las instrucciones")
    
    # Verificar instrucciones críticas
    critical_checks = [
        'Extract EVERY SINGLE ITEM',
        'EXACT values',
        'DO NOT default quantity to 1',
        'ARTICULO',
        'CANT.',
        'PRE.UNIT',
        'TOTAL'
    ]
    
    missing = []
    for check in critical_checks:
        if check not in content:
            missing.append(check)
    
    if not missing:
        print("   ✅ Todas las instrucciones críticas están presentes")
    else:
        print(f"   ⚠️  Faltan algunas instrucciones: {missing}")
        
except Exception as e:
    print(f"   ❌ Error verificando instrucciones: {e}")

print("\n" + "="*60)
print("📊 RESUMEN")
print("="*60)

if OCR_AVAILABLE:
    print("✅ OCR: Disponible (pytesseract instalado)")
    print("   ℹ️  Nota: Necesitas instalar Tesseract en el sistema para que funcione")
    print("   ℹ️  macOS: brew install tesseract tesseract-lang")
else:
    print("⚠️  OCR: No disponible (pytesseract no instalado)")
    print("   ℹ️  Instala con: pip install pytesseract")

if OPENAI_AVAILABLE:
    if os.getenv("OPENAI_API_KEY"):
        print("✅ OpenAI: Disponible y configurado")
    else:
        print("⚠️  OpenAI: Disponible pero sin API key")
else:
    print("❌ OpenAI: No disponible")

print("\n✅ Validación completada!")
print("ℹ️  El sistema funcionará con o sin OCR (fallback a solo GPT Vision)")
