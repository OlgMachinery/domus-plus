# Validación FASE 1 — Checklist operativo

## Orden de ejecución

1. **Migración** → ejecutar `migrations/20250219_budget_entities_and_categories.sql`
2. **Script de prueba** → ejecutar `test_fase1_trigger.sql`
3. **Validación final** → ejecutar las consultas de verificación (abajo)

---

## Paso 1: Ejecutar migración

- En Supabase: **SQL Editor** → Nueva query.
- Copiar todo el contenido de `supabase/migrations/20250219_budget_entities_and_categories.sql`.
- Pegar y **Run**.
- **Éxito:** mensaje tipo "Success" y sin errores en rojo.

---

## Paso 2: Ejecutar script de prueba

- En SQL Editor: nueva query.
- Copiar todo el contenido de `supabase/test_fase1_trigger.sql`.
- Pegar y **Run**.
- **Éxito:** el SELECT final devuelve 1 fila con `spent_amount = 1000`, `remaining = 4000`.

---

## Paso 3: Verificación en SQL Editor

Ejecutar cada consulta en una query. Comparar con el resultado esperado.

### 3.1 Tablas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('budget_categories', 'budget_entities', 'entity_budget_allocations')
ORDER BY table_name;
```

**Resultado esperado:** exactamente **3 filas**:

| table_name             |
|------------------------|
| budget_categories      |
| budget_entities        |
| entity_budget_allocations |

Si ves 3 filas → tablas OK.

---

### 3.2 Función

```sql
SELECT proname FROM pg_proc WHERE proname = 'update_entity_budget_spent';
```

**Resultado esperado:** exactamente **1 fila**:

| proname                 |
|-------------------------|
| update_entity_budget_spent |

Si ves 1 fila → función OK.

---

### 3.3 Trigger

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'update_entity_budget_spent_trigger';
```

**Resultado esperado:** exactamente **1 fila**:

| tgname                            |
|-----------------------------------|
| update_entity_budget_spent_trigger |

Si ves 1 fila → trigger OK.

---

## Resumen

| Verificación | Consulta (sección) | Éxito = |
|--------------|--------------------|--------|
| Tablas       | 3.1                | 3 filas |
| Función      | 3.2                | 1 fila  |
| Trigger      | 3.3                | 1 fila  |

Si las tres verificaciones dan el resultado esperado y el script de prueba mostró `spent_amount = 1000`, la migración FASE 1 está aplicada correctamente.
