-- Tambahkan kolom station_config jsonb ke tabel lines
ALTER TABLE public.lines 
ADD COLUMN IF NOT EXISTS station_config JSONB NOT NULL DEFAULT '{"mode":"none"}'::jsonb;

-- Seed / sesuaikan data untuk line yang sudah ada supaya perilakunya tidak berubah
UPDATE public.lines 
SET station_config = '{"mode":"fixed","stations":["PC-1","PC-2"]}'::jsonb 
WHERE name ILIKE '%pc200t%' OR name ILIKE '%pc-200%';

UPDATE public.lines 
SET station_config = '{"mode":"variant","variants":[{"key":"lama","label":"TDM Lama","stations":["PA-1","PA-2","PA-3","PA-4","PA-5"]},{"key":"baru","label":"TDM Baru","stations":["PA-6","PA-7","PA-8","PA-9","PA-10"]}],"default":"baru"}'::jsonb 
WHERE name ILIKE '%tandem%';
