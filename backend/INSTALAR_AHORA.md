# 🚀 Instalar Tesseract OCR Ahora

## Instalación Rápida

He creado un script que instala todo automáticamente. Ejecuta:

```bash
cd backend
bash instalar_tesseract_ahora.sh
```

Este script:
1. ✅ Verifica si Homebrew está instalado (lo instala si falta)
2. ✅ Instala Tesseract OCR
3. ✅ Instala idiomas (español e inglés)
4. ✅ Verifica que todo funcione

## Instalación Manual (Alternativa)

Si prefieres hacerlo manualmente:

### 1. Instalar Homebrew (si no lo tienes):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Instalar Tesseract:
```bash
brew install tesseract tesseract-lang
```

### 3. Verificar instalación:
```bash
tesseract --version
python3 verificar_ocr.py
```

## ¿Qué hace este script?

- ✅ Instala Homebrew si no está instalado
- ✅ Actualiza Homebrew
- ✅ Instala Tesseract OCR
- ✅ Instala idiomas (español e inglés)
- ✅ Verifica que todo funcione correctamente

## Notas

- El script puede pedirte tu contraseña de administrador
- La instalación puede tardar unos minutos
- Una vez instalado, el sistema usará OCR + GPT Vision automáticamente

## Después de la instalación

Ejecuta el script de verificación para confirmar:

```bash
python3 verificar_ocr.py
```

Deberías ver:
```
✅ Tesseract instalado
✅ pytesseract (Python): INSTALADO
✅ OCR funcionando: SÍ
🎉 ¡OCR está completamente instalado y funcionando!
```
