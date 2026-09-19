-- ==============================================================================
-- MIGRATION: Allow operator to soft-delete / delete prod_downtime_log
-- Operators are permitted to delete their daily downtime records (Downtime Hari Ini).
-- This aligns prod_downtime_log policies with prod_production_log and prod_dandori_log.
-- ==============================================================================

-- 1. Ensure UPDATE policy includes 'operator' (used for soft-delete: UPDATE ... SET is_active = false)
DROP POLICY IF EXISTS "Admin/Leader bisa update prod_downtime_log" ON public.prod_downtime_log;
DROP POLICY IF EXISTS "Operator/Leader/Admin bisa update prod_downtime_log" ON public.prod_downtime_log;

CREATE POLICY "Operator/Leader/Admin bisa update prod_downtime_log"
  ON public.prod_downtime_log FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader', 'operator')
    )
  );

-- 2. Update DELETE policy to include 'operator' (used if hard-delete is executed)
DROP POLICY IF EXISTS "Admin/Leader bisa hapus prod_downtime_log" ON public.prod_downtime_log;
DROP POLICY IF EXISTS "Operator/Leader/Admin bisa hapus prod_downtime_log" ON public.prod_downtime_log;

CREATE POLICY "Operator/Leader/Admin bisa hapus prod_downtime_log"
  ON public.prod_downtime_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader', 'operator')
    )
  );

-- Beritahu PostgREST untuk memuat ulang schema cache
NOTIFY pgrst, 'reload schema';
