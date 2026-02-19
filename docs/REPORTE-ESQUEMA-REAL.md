# Reporte del esquema real (Supabase)

Para obtener el reporte basado en la **base de datos real** (no solo `schema.sql`):

## Opción A – Script Node (recomendado)

1. En la raíz del repo instala dependencias y ejecuta:
   ```bash
   npm install
   DATABASE_URL="postgresql://postgres:[TU_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" npm run report:schema
   ```
   La connection string la encuentras en: **Supabase Dashboard → Project Settings → Database → Connection string (URI)**.

2. Copia toda la salida del comando y pégala en un archivo o aquí para tener el reporte en texto pegable.

## Opción B – SQL Editor de Supabase

1. Abre **Supabase Dashboard → SQL Editor**.
2. Abre el archivo `supabase/report-real-schema.sql`.
3. Ejecuta **cada bloque** por separado (cada `SELECT`).
4. Copia cada resultado en orden y pégalo en un solo texto con estos títulos:

```
--- 1) TABLAS (schema public) ---
(pégame aquí el resultado)

--- 2) RUTINAS ---
(pégame aquí el resultado)

--- 3) TRIGGERS ---
...

--- 4) FUNCIONES (pg_proc) ---
...

--- 5) COLUMNAS user_budgets ---
...

--- 6) ENUMS ---
...
```

Cuando tengas el resultado (por script o por SQL Editor), pégalo en este documento debajo de "Resultado" o comparte el texto y se puede dejar como reporte definitivo pegable.

---

## Resultado (pegar aquí después de ejecutar)

```
(pegar aquí la salida de npm run report:schema o los resultados del SQL Editor)
```
