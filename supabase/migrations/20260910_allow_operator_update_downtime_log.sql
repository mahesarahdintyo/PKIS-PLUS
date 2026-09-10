-- ==============================================================================
-- MIGRATION: Allow operator to update prod_downtime_log
-- Operator is allowed to edit downtime entries, but NOT delete them.
-- DELETE remains restricted to admin and leader only.
-- ==============================================================================

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
