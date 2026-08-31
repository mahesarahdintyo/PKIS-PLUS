-- ==============================================================================
-- MIGRATION: Drop unused prod_line_settings table & trigger
-- ==============================================================================
-- Tabel ini nol referensi di kode dan sudah digantikan oleh kolom `station_config` di `lines`.

DROP TRIGGER IF EXISTS trg_create_default_line_settings ON public.lines;
DROP FUNCTION IF EXISTS public.create_default_line_settings();
DROP TABLE IF EXISTS public.prod_line_settings;
