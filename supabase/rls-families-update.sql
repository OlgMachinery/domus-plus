-- Permite que el administrador de la familia pueda editar la familia (nombre, moneda, día de corte, etc.).
-- Ejecutar en Supabase SQL Editor si ya tienes el proyecto creado y no puedes editar la familia.

-- Eliminar política si existe (por si se ejecuta dos veces)
DROP POLICY IF EXISTS "Family admin can update family" ON public.families;

-- El admin de la familia puede hacer UPDATE en su familia
CREATE POLICY "Family admin can update family" ON public.families
  FOR UPDATE
  USING (
    id IN (
      SELECT family_id FROM public.users
      WHERE id = auth.uid() AND is_family_admin = true
    )
  );
