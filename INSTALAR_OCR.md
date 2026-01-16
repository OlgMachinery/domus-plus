# 📦 Instalación de OCR (Tesseract) para Procesamiento de Recibos

## ✅ Implementación Completada

Se ha implementado **OCR + GPT Vision** para mejorar la velocidad y precisión en la extracción de datos de recibos.

### 🚀 Ventajas de OCR + GPT Vision

1. **Velocidad mejorada**: OCR extrae texto rápidamente antes de enviar a GPT Vision
2. **Mayor precisión**: GPT Vision usa el texto OCR como contexto y la imagen para validar/corregir
3. **Mejor detección de items**: El texto OCR ayuda a identificar todos los items del recibo
4. **Corrección de errores**: GPT Vision puede corregir errores comunes de OCR usando la imagen

## 📋 Requisitos

### 1. Instalar Tesseract OCR

El paquete `pytesseract` requiere que Tesseract OCR esté instalado en el sistema.

#### macOS
```bash
brew install tesseract
brew install tesseract-lang  # Para soporte de español
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
sudo apt-get install tesseract-ocr-spa  # Para soporte de español
```

#### Windows
1. Descargar el instalador desde: https://github.com/UB-Mannheim/tesseract/wiki
2. Instalar Tesseract (incluye español por defecto)
3. Agregar Tesseract al PATH o configurar la ruta en el código

### 2. Instalar dependencias de Python

```bash
cd backend
pip install pytesseract
```

O instalar todas las dependencias:
```bash
pip install -r requirements.txt
```

## 🔧 Configuración Opcional

Si Tesseract no está en el PATH, puedes configurar la ruta manualmente en `receipt_processor.py`:

```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'/usr/local/bin/tesseract'  # macOS
# o
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows
```

## 🧪 Cómo Funciona

1. **OCR extrae texto** de la imagen del recibo (muy rápido, ~1-2 segundos)
2. **El texto OCR se incluye** en el prompt de GPT Vision como contexto
3. **GPT Vision procesa** la imagen + texto OCR para extraer datos estructurados
4. **GPT Vision corrige** errores de OCR usando la imagen como fuente de verdad

## ⚠️ Notas Importantes

- Si OCR no está disponible, el sistema **continúa funcionando** solo con GPT Vision (comportamiento anterior)
- OCR es opcional pero recomendado para mejor rendimiento
- El texto OCR se limita a 5000 caracteres para no sobrecargar el prompt
- GPT Vision siempre usa la **imagen como fuente de verdad**, el OCR es solo contexto

## ✅ Verificación

Para verificar que OCR está funcionando, revisa los logs al procesar un recibo:

```
🔍 Extrayendo texto con OCR...
✅ OCR extrajo 1234 caracteres de texto
📄 Texto OCR extraído: 1234 caracteres
🔄 Procesando con gpt-4o-mini...
```

Si ves `⚠️ OCR no disponible`, significa que Tesseract no está instalado o no está en el PATH.
