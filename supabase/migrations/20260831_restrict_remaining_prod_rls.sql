-- ==============================================================================
-- MIGRATION: Restrict RLS UPDATE/DELETE policies for production tables
-- Scope UPDATE and DELETE to admin/leader only (previously: all authenticated)
-- ==============================================================================
-- ⚠️ MUST BE EXECUTED MANUALLY in Supabase Dashboard > SQL Editor
-- Context: canDeleteRow / canEditRow logic in MachineDetailClient.tsx
--   enforces these rules in the UI, this migration enforces them at DB level.

-- --------------------------------------------------------------------------
-- 1. prod_downtime_log
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Login bisa update prod_downtime_log" ON public.prod_downtime_log;
DROP POLICY IF EXISTS "Login bisa hapus prod_downtime_log"  ON public.prod_downtime_log;

CREATE POLICY "Admin/Leader bisa update prod_downtime_log"
  ON public.prod_downtime_log FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa hapus prod_downtime_log"
  ON public.prod_downtime_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- --------------------------------------------------------------------------
-- 2. prod_part_numbers
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Login bisa update prod_part_numbers" ON public.prod_part_numbers;
DROP POLICY IF EXISTS "Login bisa hapus prod_part_numbers"  ON public.prod_part_numbers;

CREATE POLICY "Admin/Leader bisa update prod_part_numbers"
  ON public.prod_part_numbers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa hapus prod_part_numbers"
  ON public.prod_part_numbers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- --------------------------------------------------------------------------
-- 3. prod_downtime_problems
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Login bisa update prod_downtime_problems" ON public.prod_downtime_problems;
DROP POLICY IF EXISTS "Login bisa hapus prod_downtime_problems"  ON public.prod_downtime_problems;

CREATE POLICY "Admin/Leader bisa update prod_downtime_problems"
  ON public.prod_downtime_problems FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa hapus prod_downtime_problems"
  ON public.prod_downtime_problems FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- --------------------------------------------------------------------------
-- 4. prod_nonproduksi_types
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Login bisa update prod_nonproduksi_types" ON public.prod_nonproduksi_types;
DROP POLICY IF EXISTS "Login bisa hapus prod_nonproduksi_types"  ON public.prod_nonproduksi_types;

CREATE POLICY "Admin/Leader bisa update prod_nonproduksi_types"
  ON public.prod_nonproduksi_types FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa hapus prod_nonproduksi_types"
  ON public.prod_nonproduksi_types FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );
