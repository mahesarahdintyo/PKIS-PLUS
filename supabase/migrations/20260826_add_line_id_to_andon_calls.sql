-- Migration: Add line_id and line_name to andon_calls table
ALTER TABLE public.andon_calls ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;
ALTER TABLE public.andon_calls ADD COLUMN IF NOT EXISTS line_name text;

-- Index for querying andon calls by line_id
CREATE INDEX IF NOT EXISTS idx_andon_calls_line_id ON public.andon_calls(line_id);
