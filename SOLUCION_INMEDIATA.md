# 🔧 Solución Inmediata - Crear Base de Datos

## Problema Actual
- ✅ Entorno virtual activado
- ✅ Base de datos existe pero está vacía (0 bytes)
- ❌ Dependencias no instaladas

## Solución: Ejecuta estos comandos

En tu terminal (donde ya tienes `(venv)` activado), ejecuta:

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Crear las tablas en la base de datos
python3 crear_bd.py
```

## O usa el script automático:

```bash
bash instalar_y_crear_bd.sh
```

## Verificar que funcionó

Después de ejecutar los comandos, verifica:

```bash
# Ver el tamaño de la base de datos (debería ser mayor a 0 bytes)
ls -lh domus_plus.db

# Ver las tablas creadas
python3 -c "import sqlite3; conn = sqlite3.connect('domus_plus.db'); cursor = conn.cursor(); cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table'\"); [print(t[0]) for t in cursor.fetchall()]"
```

## Nota Importante

**NO ejecutes código Python directamente en zsh**. Por ejemplo:
- ❌ `Base.metadata.create_all(bind=engine)` - Esto no funciona en zsh
- ✅ `python3 crear_bd.py` - Esto sí funciona

## Después de crear la BD

1. Si el servidor está corriendo, reinícialo (Ctrl+C y luego `uvicorn app.main:app --reload`)
2. O si no está corriendo, inícialo:
   ```bash
   uvicorn app.main:app --reload
   ```

## Probar el Registro

1. Ve a http://localhost:3000/register
2. Llena el formulario
3. Debería funcionar ahora

