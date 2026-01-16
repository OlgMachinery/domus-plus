# 🔄 Actualizar Base de Datos - Nuevos Campos de Presupuestos

## ⚠️ Importante

Antes de usar las nuevas funcionalidades de presupuestos, necesitas actualizar la base de datos para agregar los nuevos campos.

## 📋 Pasos para Actualizar

### Opción 1: Script Automático (Recomendado)

1. **Detén el backend** (si está corriendo):
   ```bash
   # Presiona Ctrl+C en la terminal donde corre el backend
   ```

2. **Ejecuta el script de migración**:
   ```bash
   cd /Users/gonzalomontanofimbres/domus-plus/backend
   python3 migrate_add_budget_fields.py
   ```

3. **Verifica que funcionó**:
   Deberías ver mensajes como:
   ```
   ✅ Columna 'budget_type' agregada
   ✅ Columna 'distribution_method' agregada
   ✅ Columna 'auto_distribute' agregada
   ✅ Columna 'target_user_id' agregada
   ✅ Migración completada exitosamente!
   ```

4. **Reinicia el backend**:
   ```bash
   source venv/bin/activate
   export DATABASE_URL="sqlite:///./domus_plus.db"
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Opción 2: Manual (Si el script falla)

Si el script automático no funciona, puedes ejecutar estos comandos SQL directamente:

```bash
cd /Users/gonzalomontanofimbres/domus-plus/backend
sqlite3 domus_plus.db
```

Luego ejecuta estos comandos SQL:

```sql
-- Agregar columna budget_type
ALTER TABLE family_budgets ADD COLUMN budget_type VARCHAR(20) DEFAULT 'shared';
UPDATE family_budgets SET budget_type = 'shared' WHERE budget_type IS NULL;

-- Agregar columna distribution_method
ALTER TABLE family_budgets ADD COLUMN distribution_method VARCHAR(20) DEFAULT 'equal';
UPDATE family_budgets SET distribution_method = 'equal' WHERE distribution_method IS NULL;

-- Agregar columna auto_distribute
ALTER TABLE family_budgets ADD COLUMN auto_distribute BOOLEAN DEFAULT 1;
UPDATE family_budgets SET auto_distribute = 1 WHERE auto_distribute IS NULL;

-- Agregar columna target_user_id
ALTER TABLE family_budgets ADD COLUMN target_user_id INTEGER;

-- Salir de SQLite
.quit
```

## ✅ Verificación

Después de la migración, verifica que todo funcionó:

1. **Reinicia el backend**
2. **Abre el frontend**: http://localhost:3000
3. **Ve a Presupuestos**
4. **Intenta crear un nuevo presupuesto**
5. **Deberías ver las opciones de "Común" e "Individual"**

## 🐛 Solución de Problemas

**Error: "attempt to write a readonly database"**
- Verifica que tengas permisos de escritura en el archivo `domus_plus.db`
- Asegúrate de que el backend no esté corriendo
- Intenta ejecutar con permisos de administrador si es necesario

**Error: "column already exists"**
- Esto significa que la migración ya se ejecutó
- Puedes continuar normalmente

**Error: "no such table: family_budgets"**
- La base de datos no existe o está vacía
- Ejecuta primero: `python3 crear_bd.py` o `python3 init_db.py`

## 📝 Notas

- La migración es **segura** y no elimina datos existentes
- Los presupuestos existentes se marcan como "shared" (común) por defecto
- Puedes ejecutar el script múltiples veces sin problemas
