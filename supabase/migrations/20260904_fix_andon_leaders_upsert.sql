-- =========================================================
-- MIGRATION: Fix andon_leaders upsert — tambahkan WITH CHECK pada UPDATE policy
-- agar upsert (INSERT ... ON CONFLICT DO UPDATE) berjalan tanpa error RLS.
-- =========================================================

-- Drop dan recreate UPDATE policy dengan WITH CHECK clause
DROP POLICY IF EXISTS "Admin/Leader bisa update andon_leaders" ON public.andon_leaders;

CREATE POLICY "Admin/Leader bisa update andon_leaders"
  ON public.andon_leaders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );
