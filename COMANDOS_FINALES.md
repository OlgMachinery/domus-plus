# ✅ Comandos Finales - Paso a Paso

## ⚠️ IMPORTANTE: Activa el Entorno Virtual Primero

**Debes ver `(venv)` al inicio de tu prompt antes de ejecutar pip o python3**

## Paso 1: Activar el Entorno Virtual

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
```

**Después de esto, deberías ver:**
```
(venv) gonzalomontanofimbres@MacBook-Pro-de-Gonzalo backend %
```

Si **NO ves `(venv)`**, el entorno virtual no está activado.

## Paso 2: Instalar Dependencias

```bash
pip install -r requirements-minimal.txt
```

Espera a que termine (puede tardar 1-2 minutos).

## Paso 3: Crear la Base de Datos

```bash
python3 crear_bd.py
```

Deberías ver:
```
🗄️  Creando base de datos SQLite...
✅ Base de datos creada exitosamente!
```

## Paso 4: Iniciar el Servidor

```bash
uvicorn app.main:app --reload
```

Deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

## ✅ Verificar que Funciona

Abre en tu navegador:
- http://localhost:8000/health
- Debería mostrar: `{"status":"ok"}`

## 🎯 Probar el Registro

1. Ve a http://localhost:3000/register
2. Llena el formulario
3. Debería funcionar ahora

## 🔍 Cómo Saber si el Entorno Virtual Está Activo

**✅ Activado:**
```
(venv) gonzalomontanofimbres@MacBook-Pro-de-Gonzalo backend %
```

**❌ NO activado:**
```
gonzalomontanofimbres@MacBook-Pro-de-Gonzalo backend %
```

Si no ves `(venv)`, vuelve al Paso 1.

