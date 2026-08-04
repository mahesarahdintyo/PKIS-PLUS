ALTER TABLE public.production_reports
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

CREATE INDEX IF NOT EXISTS production_reports_is_active_idx
  ON public.production_reports (is_active);

UPDATE public.production_reports
SET is_active = true
WHERE is_active IS NULL;
