# 🗄️ Crear Base de Datos SQLite - DOMUS+

## Opción 1: Script Automático (Recomendado)

Ejecuta este comando en tu terminal:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
bash setup_and_init_db.sh
```

Este script:
1. ✅ Crea el entorno virtual (si no existe)
2. ✅ Instala todas las dependencias
3. ✅ Crea la base de datos SQLite con todas las tablas

## Opción 2: Manual (Paso a Paso)

### 1. Crear y activar entorno virtual

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar dependencias

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Crear la base de datos

```bash
python3 init_db.py
```

Deberías ver:
```
🗄️  Inicializando base de datos SQLite...
✅ Base de datos inicializada correctamente!
📁 Ubicación: /ruta/a/domus_plus.db

Tablas creadas:
  - users
  - families
  - family_budgets
  - user_budgets
  - transactions
```

## Opción 3: Se crea automáticamente al iniciar el servidor

La base de datos también se crea automáticamente cuando inicias el servidor con:

```bash
uvicorn app.main:app --reload
```

El archivo `app/main.py` tiene la línea:
```python
Base.metadata.create_all(bind=engine)
```

Esto crea todas las tablas al iniciar el servidor.

## Verificar que la BD existe

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
ls -lh domus_plus.db
```

Deberías ver el archivo de la base de datos.

## Ubicación de la Base de Datos

La base de datos SQLite se crea en:
```
/Users/gonzalomontanofimbres/domus-plus/backend/domus_plus.db
```

## Tablas Creadas

La base de datos incluye las siguientes tablas:
- `users` - Usuarios del sistema
- `families` - Familias
- `family_budgets` - Presupuestos familiares
- `user_budgets` - Presupuestos asignados a usuarios
- `transactions` - Transacciones/gastos

## Solución de Problemas

### Error: "ModuleNotFoundError: No module named 'sqlalchemy'"
Necesitas instalar las dependencias:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

### Error: "No such file or directory: venv"
Crea el entorno virtual primero:
```bash
python3 -m venv venv
source venv/bin/activate
```

### La base de datos no se crea
Verifica que el archivo `.env` tenga:
```env
DATABASE_URL=sqlite:///./domus_plus.db
```

