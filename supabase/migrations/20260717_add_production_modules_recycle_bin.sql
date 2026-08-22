-- Migration: Add is_active column and indexes to production module tables for Recycle Bin soft delete

-- 1. prod_attendance_log
ALTER TABLE public.prod_attendance_log
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_attendance_log_is_active_idx
  ON public.prod_attendance_log (is_active);
UPDATE public.prod_attendance_log SET is_active = true WHERE is_active IS NULL;

-- 2. productivity_daily_reference (Create if not exists, otherwise add column)
CREATE TABLE IF NOT EXISTS public.productivity_daily_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal DATE NOT NULL UNIQUE,
  eh_jam NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.productivity_daily_reference
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS productivity_daily_ref_is_active_idx
  ON public.productivity_daily_reference (is_active);
UPDATE public.productivity_daily_reference SET is_active = true WHERE is_active IS NULL;

ALTER TABLE public.productivity_daily_reference ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'productivity_daily_reference' AND policyname = 'Login bisa lihat productivity_daily_reference'
  ) THEN
    CREATE POLICY "Login bisa lihat productivity_daily_reference" ON public.productivity_daily_reference FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'productivity_daily_reference' AND policyname = 'Admin/Leader kelola productivity_daily_reference'
  ) THEN
    CREATE POLICY "Admin/Leader kelola productivity_daily_reference" ON public.productivity_daily_reference FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','leader')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','leader')));
  END IF;
END $$;

-- 3. prod_scrap_top_end
ALTER TABLE public.prod_scrap_top_end
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_scrap_top_end_is_active_idx
  ON public.prod_scrap_top_end (is_active);
UPDATE public.prod_scrap_top_end SET is_active = true WHERE is_active IS NULL;

-- 4. prod_safety_log
ALTER TABLE public.prod_safety_log
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_safety_log_is_active_idx
  ON public.prod_safety_log (is_active);
UPDATE public.prod_safety_log SET is_active = true WHERE is_active IS NULL;

-- 5. prod_production_log
ALTER TABLE public.prod_production_log
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_production_log_is_active_idx
  ON public.prod_production_log (is_active);
UPDATE public.prod_production_log SET is_active = true WHERE is_active IS NULL;

-- 6. prod_downtime_log
ALTER TABLE public.prod_downtime_log
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_downtime_log_is_active_idx
  ON public.prod_downtime_log (is_active);
UPDATE public.prod_downtime_log SET is_active = true WHERE is_active IS NULL;

-- 7. prod_dandori_log
ALTER TABLE public.prod_dandori_log
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_dandori_log_is_active_idx
  ON public.prod_dandori_log (is_active);
UPDATE public.prod_dandori_log SET is_active = true WHERE is_active IS NULL;

-- 8. prod_production_planning
ALTER TABLE public.prod_production_planning
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_production_planning_is_active_idx
  ON public.prod_production_planning (is_active);
UPDATE public.prod_production_planning SET is_active = true WHERE is_active IS NULL;

-- 9. andon_leaders (Create if not exists, otherwise add column)
CREATE TABLE IF NOT EXISTS public.andon_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  mesin TEXT NOT NULL,
  tier SMALLINT NOT NULL CHECK (tier IN (1, 2)),
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mesin, tier)
);

ALTER TABLE public.andon_leaders
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS andon_leaders_is_active_idx
  ON public.andon_leaders (is_active);
UPDATE public.andon_leaders SET is_active = true WHERE is_active IS NULL;

ALTER TABLE public.andon_leaders ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'andon_leaders' AND policyname = 'Login bisa lihat andon_leaders'
  ) THEN
    CREATE POLICY "Login bisa lihat andon_leaders" ON public.andon_leaders FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'andon_leaders' AND policyname = 'Admin/Leader kelola andon_leaders'
  ) THEN
    CREATE POLICY "Admin/Leader kelola andon_leaders" ON public.andon_leaders FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','leader')))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','leader')));
  END IF;
END $$;

-- 10. prod_part_numbers
ALTER TABLE public.prod_part_numbers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_part_numbers_is_active_idx
  ON public.prod_part_numbers (is_active);
UPDATE public.prod_part_numbers SET is_active = true WHERE is_active IS NULL;

-- 11. prod_nonproduksi_types
ALTER TABLE public.prod_nonproduksi_types
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_nonprod_types_is_active_idx
  ON public.prod_nonproduksi_types (is_active);
UPDATE public.prod_nonproduksi_types SET is_active = true WHERE is_active IS NULL;

-- 12. prod_downtime_problems
ALTER TABLE public.prod_downtime_problems
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
CREATE INDEX IF NOT EXISTS prod_downtime_problems_is_active_idx
  ON public.prod_downtime_problems (is_active);
UPDATE public.prod_downtime_problems SET is_active = true WHERE is_active IS NULL;
