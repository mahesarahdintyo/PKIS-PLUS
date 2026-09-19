-- ==============================================================================
-- MIGRATION: Add break_menit to prod_dandori_log
-- Menambahkan kolom break_menit untuk mencatat waktu istirahat / break pada data non-produksi
-- ==============================================================================

ALTER TABLE public.prod_dandori_log
  ADD COLUMN IF NOT EXISTS break_menit integer DEFAULT 0;

-- Beritahu PostgREST untuk memuat ulang schema cache
NOTIFY pgrst, 'reload schema';
