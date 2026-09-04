-- ==============================================================================
-- MIGRATION: Allow operator to update prod_production_log and prod_dandori_log
-- Operator is allowed to edit their production entries, but NOT delete them.
-- DELETE remains restricted to admin and leader only.
-- ==============================================================================

-- 1. prod_production_log UPDATE policy
DROP POLICY IF EXISTS "Admin/Leader bisa update prod_production_log" ON public.prod_production_log;
DROP POLICY IF EXISTS "Operator/Leader/Admin bisa update prod_production_log" ON public.prod_production_log;

CREATE POLICY "Operator/Leader/Admin bisa update prod_production_log"
  ON public.prod_production_log FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader', 'operator')
    )
  );

-- 2. prod_dandori_log UPDATE policy
DROP POLICY IF EXISTS "Admin/Leader bisa update prod_dandori_log" ON public.prod_dandori_log;
DROP POLICY IF EXISTS "Operator/Leader/Admin bisa update prod_dandori_log" ON public.prod_dandori_log;

CREATE POLICY "Operator/Leader/Admin bisa update prod_dandori_log"
  ON public.prod_dandori_log FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader', 'operator')
    )
  );
