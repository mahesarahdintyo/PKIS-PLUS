-- ==============================================================================
-- MIGRATION: Add target_availability to prod_mesin_settings
-- Menambahkan kolom target_availability untuk menyimpan target availability (%) per mesin
-- ==============================================================================

ALTER TABLE public.prod_mesin_settings
  ADD COLUMN IF NOT EXISTS target_availability numeric DEFAULT 0;

-- Beritahu PostgREST untuk memuat ulang schema cache
NOTIFY pgrst, 'reload schema';
