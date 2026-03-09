# Nota: Base de datos Supabase y proyecto

Este proyecto **no se construyó desde cero en Supabase**. La base de datos que usas puede ser de un proyecto anterior o haberse creado de forma incremental. Las tablas y columnas que el código espera a veces no existen aún en la BD.

**Implicación:** Cuando agregues o arregles un apartado que use Supabase, ten en cuenta:

1. **Nuevas columnas:** Si el código usa una columna que no existe (ej. `can_create_events` en `users`), verás errores tipo *"Could not find the 'X' column in the schema cache"*. Solución: ejecutar en **Supabase → SQL Editor** el script o migración que añada esa columna (o el bloque correspondiente de una migración existente).
2. **Nuevas tablas o funciones:** Igual: si la app llama a una función o tabla que no está en tu proyecto de Supabase, hay que crear esa función o tabla ejecutando el SQL en el SQL Editor.
3. **Scripts de sincronización:** En `supabase/` hay scripts para alinear la BD con lo que espera la app:
   - **`sync-users-columns.sql`** — Añade a `users` las columnas de permisos (can_register_expenses, can_upload_receipts, can_create_events, can_view_global_summary) si no existen.
   - **`funcion-crear-familia-auto.sql`** — Crea la función `create_family_for_user`.
   - **`fix-rls-infinite-recursion.sql`** — Corrige políticas RLS en `users` para evitar recursión infinita.

Al añadir nuevas funcionalidades que requieran cambios en la BD, documenta aquí el script o la migración que hay que ejecutar en Supabase para que la BD quede alineada.
