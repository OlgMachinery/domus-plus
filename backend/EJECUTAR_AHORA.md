# 🚀 Instrucciones para Instalar e Iniciar el Backend

## Problema detectado
El shell tiene un problema de configuración que impide ejecutar comandos automáticamente. Sigue estos pasos manualmente:

## Paso 1: Instalar Dependencias

Abre una **nueva terminal** (no uses la que tiene problemas) y ejecuta:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
```

## Paso 2: Verificar Instalación

```bash
python3 diagnosticar_inicio.py
```

Deberías ver todos los checks con ✅

## Paso 3: Iniciar el Backend

```bash
./iniciar_backend.sh
```

O manualmente:

```bash
source venv/bin/activate
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Si hay errores de permisos

Si ves errores de permisos, usa:

```bash
pip install --user -r requirements.txt
```

## Verificar que el backend está corriendo

Deberías ver:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

Luego ve a tu navegador: http://localhost:3000/dashboard

El error de conexión debería desaparecer.
