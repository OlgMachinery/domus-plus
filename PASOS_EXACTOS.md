# 📝 Pasos Exactos - Sin Comentarios

## Paso 1: Activar el Entorno Virtual

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
source venv/bin/activate
```

**IMPORTANTE**: Después de ejecutar esto, deberías ver `(venv)` al inicio de tu prompt.

## Paso 2: Instalar Dependencias

```bash
pip install -r requirements.txt
```

Espera a que termine la instalación (puede tardar unos minutos).

## Paso 3: Crear la Base de Datos

```bash
python3 crear_bd.py
```

Deberías ver mensajes como:
```
🗄️  Creando base de datos SQLite...
✅ Base de datos creada exitosamente!
```

## Paso 4: Verificar que la BD se Creó

```bash
ls -lh domus_plus.db
```

Deberías ver un tamaño mayor a 0 bytes (por ejemplo: 12K, 24K, etc.)

## Paso 5: Iniciar el Servidor

```bash
uvicorn app.main:app --reload
```

Deberías ver:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

## ✅ Verificar que Todo Funciona

Abre en tu navegador:
- http://localhost:8000/health
- Debería mostrar: `{"status":"ok"}`

## 🎯 Probar el Registro

1. Ve a http://localhost:3000/register
2. Llena el formulario
3. Debería funcionar ahora

## ⚠️ Notas Importantes

- **NO copies los comentarios** (líneas que empiezan con #)
- **Solo copia los comandos** (líneas que empiezan con palabras como `cd`, `source`, `pip`, etc.)
- **Asegúrate de ver `(venv)`** en tu prompt antes de ejecutar pip o python3
- Si no ves `(venv)`, vuelve al Paso 1

