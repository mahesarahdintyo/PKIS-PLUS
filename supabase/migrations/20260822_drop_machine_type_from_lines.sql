-- Migration: Drop machine_type column from lines table
-- Konsep machine_type tidak digunakan, setiap baris di tabel lines mewakili line/mesin itu sendiri.

ALTER TABLE public.lines DROP COLUMN IF EXISTS machine_type;
DROP INDEX IF EXISTS public.idx_lines_machine_type;
