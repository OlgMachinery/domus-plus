#!/usr/bin/env python3
"""
Script para verificar si OCR (Tesseract) está instalado y funcionando.
"""

import sys
import os
import subprocess

print("🔍 Verificando instalación de OCR (Tesseract)\n")
print("="*60)

# Test 1: Verificar Tesseract del sistema
print("\n1️⃣ Verificando Tesseract del sistema...")
try:
    result = subprocess.run(
        ['tesseract', '--version'],
        capture_output=True,
        text=True,
        timeout=5
    )
    if result.returncode == 0:
        version_line = result.stdout.split('\n')[0] if result.stdout else "N/A"
        print(f"   ✅ Tesseract instalado: {version_line}")
        
        # Verificar idiomas instalados
        try:
            lang_result = subprocess.run(
                ['tesseract', '--list-langs'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if lang_result.returncode == 0:
                langs = [line.strip() for line in lang_result.stdout.split('\n') if line.strip()]
                if 'spa' in langs:
                    print(f"   ✅ Español (spa) disponible")
                else:
                    print(f"   ⚠️  Español (spa) no encontrado en idiomas instalados")
                if 'eng' in langs:
                    print(f"   ✅ Inglés (eng) disponible")
                print(f"   📋 Idiomas disponibles: {', '.join(langs[:10])}{'...' if len(langs) > 10 else ''}")
        except Exception as e:
            print(f"   ⚠️  No se pudo verificar idiomas: {e}")
    else:
        print("   ❌ Tesseract no responde correctamente")
        TESSERACT_INSTALLED = False
except FileNotFoundError:
    print("   ❌ Tesseract NO está instalado en el sistema")
    print("   📝 Para instalar en macOS: brew install tesseract tesseract-lang")
    print("   📝 Para instalar en Linux: sudo apt-get install tesseract-ocr tesseract-ocr-spa")
    TESSERACT_INSTALLED = False
except subprocess.TimeoutExpired:
    print("   ⚠️  Tesseract tardó demasiado en responder")
    TESSERACT_INSTALLED = False
except Exception as e:
    print(f"   ⚠️  Error al verificar Tesseract: {e}")
    TESSERACT_INSTALLED = False
else:
    TESSERACT_INSTALLED = True

# Test 2: Verificar pytesseract (dependencia de Python)
print("\n2️⃣ Verificando pytesseract (dependencia de Python)...")
try:
    import pytesseract
    print("   ✅ pytesseract importado correctamente")
    
    # Verificar versión si está disponible
    try:
        version = pytesseract.__version__
        print(f"   ✅ Versión: {version}")
    except:
        print("   ✅ pytesseract disponible (versión no disponible)")
    
    # Verificar que puede encontrar tesseract
    try:
        tesseract_cmd = pytesseract.pytesseract.tesseract_cmd
        if tesseract_cmd:
            print(f"   ✅ Ruta de Tesseract: {tesseract_cmd}")
            if os.path.exists(tesseract_cmd):
                print("   ✅ Archivo de Tesseract existe")
            else:
                print("   ⚠️  Archivo de Tesseract no encontrado en la ruta especificada")
    except:
        print("   ⚠️  No se pudo obtener la ruta de Tesseract")
    
    PYTESSERACT_AVAILABLE = True
except ImportError:
    print("   ❌ pytesseract NO está instalado")
    print("   📝 Para instalar: pip install pytesseract")
    PYTESSERACT_AVAILABLE = False
except Exception as e:
    print(f"   ⚠️  Error al importar pytesseract: {e}")
    PYTESSERACT_AVAILABLE = False
else:
    PYTESSERACT_AVAILABLE = True

# Test 3: Verificar que OCR funciona en el código
print("\n3️⃣ Verificando integración en el código...")
try:
    # Agregar el directorio del proyecto al path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    from app.services.receipt_processor import OCR_AVAILABLE, extract_text_with_ocr
    
    if OCR_AVAILABLE:
        print("   ✅ OCR_AVAILABLE = True en el código")
    else:
        print("   ⚠️  OCR_AVAILABLE = False en el código")
    
    if hasattr(extract_text_with_ocr, '__call__'):
        print("   ✅ Función extract_text_with_ocr() disponible")
    else:
        print("   ❌ Función extract_text_with_ocr() no encontrada")
        
except ImportError as e:
    print(f"   ⚠️  No se pudo importar el módulo (puede ser normal si faltan dependencias): {e}")
except Exception as e:
    print(f"   ⚠️  Error: {e}")

# Test 4: Prueba real de OCR (si todo está disponible)
print("\n4️⃣ Prueba real de OCR...")
if TESSERACT_INSTALLED and PYTESSERACT_AVAILABLE:
    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        import base64
        
        # Crear una imagen de prueba simple con texto
        img = Image.new('RGB', (400, 100), color='white')
        draw = ImageDraw.Draw(img)
        
        # Intentar usar una fuente
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        except:
            try:
                font = ImageFont.load_default()
            except:
                font = None
        
        text = "TEST OCR 123.45"
        draw.text((20, 35), text, fill='black', font=font)
        
        # Convertir a base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        # Intentar extraer texto
        import pytesseract
        ocr_text = pytesseract.image_to_string(img, lang='eng')
        
        if ocr_text and len(ocr_text.strip()) > 0:
            print(f"   ✅ OCR funcionando! Texto extraído: '{ocr_text.strip()}'")
            print("   ✅ OCR está completamente operativo")
            OCR_WORKING = True
        else:
            print("   ⚠️  OCR no extrajo texto (puede ser problema de calidad de imagen)")
            OCR_WORKING = False
            
    except Exception as e:
        print(f"   ⚠️  Error en prueba de OCR: {e}")
        OCR_WORKING = False
else:
    print("   ⏭️  Saltando prueba (Tesseract o pytesseract no disponible)")
    OCR_WORKING = False

# Resumen final
print("\n" + "="*60)
print("📊 RESUMEN")
print("="*60)

status_icon = {
    True: "✅",
    False: "❌"
}

print(f"\n{status_icon.get(TESSERACT_INSTALLED, '❓')} Tesseract del sistema: {'INSTALADO' if TESSERACT_INSTALLED else 'NO INSTALADO'}")
print(f"{status_icon.get(PYTESSERACT_AVAILABLE, '❓')} pytesseract (Python): {'INSTALADO' if PYTESSERACT_AVAILABLE else 'NO INSTALADO'}")

if TESSERACT_INSTALLED and PYTESSERACT_AVAILABLE:
    if OCR_WORKING:
        print(f"{status_icon.get(OCR_WORKING, '❓')} OCR funcionando: {'SÍ' if OCR_WORKING else 'NO'}")
        print("\n🎉 ¡OCR está completamente instalado y funcionando!")
        print("   El sistema usará OCR + GPT Vision para procesar recibos.")
    else:
        print("\n⚠️  OCR instalado pero no funcionó en la prueba.")
        print("   Puede ser un problema temporal. El sistema intentará usarlo.")
else:
    print("\n⚠️  OCR no está completamente instalado.")
    if not TESSERACT_INSTALLED:
        print("   📝 Instala Tesseract del sistema:")
        print("      macOS: brew install tesseract tesseract-lang")
        print("      Linux: sudo apt-get install tesseract-ocr tesseract-ocr-spa")
    if not PYTESSERACT_AVAILABLE:
        print("   📝 Instala pytesseract: pip install pytesseract")
    print("\n   ℹ️  El sistema funcionará solo con GPT Vision hasta que instales OCR.")

print("\n" + "="*60)
