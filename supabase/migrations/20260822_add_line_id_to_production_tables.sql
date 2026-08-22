-- Migration: Add line_id (FK -> public.lines) to production log tables
-- Kolom mesin (machine_type enum) TETAP DIPERTAHANKAN -- line_id adalah kolom TAMBAHAN
-- Database masih development/kosong, tidak perlu backfill data existing.

-- ============================================================
-- 1. prod_production_log
-- ============================================================
ALTER TABLE public.prod_production_log
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_production_log_line_id
  ON public.prod_production_log (line_id);

-- ============================================================
-- 2. prod_downtime_log
-- ============================================================
ALTER TABLE public.prod_downtime_log
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_downtime_log_line_id
  ON public.prod_downtime_log (line_id);

-- ============================================================
-- 3. prod_production_planning
-- ============================================================
ALTER TABLE public.prod_production_planning
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_production_planning_line_id
  ON public.prod_production_planning (line_id);

-- ============================================================
-- 4. prod_mesin_settings
-- (PK-nya adalah mesin machine_type, bukan uuid -- line_id nullable tambahan)
-- ============================================================
ALTER TABLE public.prod_mesin_settings
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_mesin_settings_line_id
  ON public.prod_mesin_settings (line_id);

-- ============================================================
-- 5. prod_dandori_log
-- ============================================================
ALTER TABLE public.prod_dandori_log
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_dandori_log_line_id
  ON public.prod_dandori_log (line_id);
