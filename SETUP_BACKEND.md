# 🔧 Configuración del Backend - DOMUS+

## Paso a Paso para Configurar el Backend

### 1. Crear el Entorno Virtual

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
python3 -m venv venv
```

### 2. Activar el Entorno Virtual

```bash
source venv/bin/activate
```

Verás que el prompt cambia a `(venv)` al inicio.

### 3. Instalar Dependencias

```bash
pip install -r requirements.txt
```

Esto instalará todas las dependencias necesarias (FastAPI, SQLAlchemy, etc.)

### 4. Configurar el Archivo .env

Edita el archivo `.env` (no solo establezcas la variable de entorno):

```bash
# Opción 1: Usar SQLite (más fácil para empezar)
DATABASE_URL=sqlite:///./domus_plus.db

# Opción 2: Usar PostgreSQL (si lo tienes instalado)
DATABASE_URL=postgresql://usuario:password@localhost:5432/domus_plus
```

**IMPORTANTE**: Edita el archivo `.env` con un editor de texto, no solo establezcas la variable en la terminal.

### 5. Iniciar el Servidor

```bash
uvicorn app.main:app --reload
```

Deberías ver algo como:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## Comandos Completos (Copia y Pega)

```bash
# 1. Ir al directorio del backend
cd /Users/gonzalomontanofimbres/domus-plus/backend

# 2. Crear entorno virtual (solo la primera vez)
python3 -m venv venv

# 3. Activar entorno virtual
source venv/bin/activate

# 4. Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# 5. Configurar .env (edita el archivo con nano, vim, o tu editor favorito)
# Cambia DATABASE_URL a: sqlite:///./domus_plus.db

# 6. Iniciar servidor
uvicorn app.main:app --reload
```

## Usar SQLite (Recomendado para Empezar)

SQLite es más fácil porque no necesitas instalar PostgreSQL. Solo cambia en `.env`:

```env
DATABASE_URL=sqlite:///./domus_plus.db
```

Y elimina o comenta las otras líneas de DATABASE_URL.

## Verificar que Funciona

1. Abre en tu navegador: http://localhost:8000/health
2. Deberías ver: `{"status":"ok"}`

## Solución de Problemas

### "python3: command not found"
Usa `python` en lugar de `python3`:
```bash
python -m venv venv
```

### "pip: command not found"
```bash
python3 -m pip install -r requirements.txt
```

### Error al instalar dependencias
```bash
# Actualizar pip primero
pip install --upgrade pip
pip install -r requirements.txt
```

### Error de base de datos
Si usas SQLite, el archivo se creará automáticamente.
Si usas PostgreSQL, asegúrate de que:
- PostgreSQL esté corriendo
- La base de datos exista
- Las credenciales en `.env` sean correctas

