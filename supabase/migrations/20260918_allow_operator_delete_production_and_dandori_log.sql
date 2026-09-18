-- ==============================================================================
-- MIGRATION: Allow operator to soft-delete / delete prod_production_log & prod_dandori_log
-- Operators are now permitted to delete their daily history entries (Riwayat Hari Ini).
-- Since the application deletes via soft-delete (UPDATE is_active = false), we ensure
-- UPDATE policies include 'operator', and we also update DELETE policies to allow 'operator'.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. prod_production_log
-- ------------------------------------------------------------------------------

-- Update Policy (used for soft-delete: UPDATE ... SET is_active = false)
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

-- Delete Policy (used if hard-delete is executed)
DROP POLICY IF EXISTS "Admin/Leader bisa hapus prod_production_log" ON public.prod_production_log;
DROP POLICY IF EXISTS "Operator/Leader/Admin bisa hapus prod_production_log" ON public.prod_production_log;

CREATE POLICY "Operator/Leader/Admin bisa hapus prod_production_log"
  ON public.prod_production_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader', 'operator')
    )
  );

-- ------------------------------------------------------------------------------
-- 2. prod_dandori_log
-- ------------------------------------------------------------------------------

-- Update Policy (used for soft-delete: UPDATE ... SET is_active = false)
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

-- Delete Policy (used if hard-delete is executed)
DROP POLICY IF EXISTS "Admin/Leader bisa hapus prod_dandori_log" ON public.prod_dandori_log;
DROP POLICY IF EXISTS "Operator/Leader/Admin bisa hapus prod_dandori_log" ON public.prod_dandori_log;

CREATE POLICY "Operator/Leader/Admin bisa hapus prod_dandori_log"
  ON public.prod_dandori_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader', 'operator')
    )
  );
