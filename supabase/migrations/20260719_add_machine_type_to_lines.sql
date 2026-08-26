-- Migration: Add machine_type column to lines table
-- Enum machine_type is used to categorize lines/machines for production modules

ALTER TABLE public.lines 
ADD COLUMN IF NOT EXISTS machine_type public.machine_type;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lines_machine_type ON public.lines (machine_type);

-- Update existing standard lines with their corresponding machine_type if needed
UPDATE public.lines 
SET machine_type = 'tandem'::public.machine_type 
WHERE (LOWER(name) LIKE '%tandem%') AND machine_type IS NULL;

UPDATE public.lines 
SET machine_type = 'blanking'::public.machine_type 
WHERE (LOWER(name) LIKE '%blanking%') AND machine_type IS NULL;

UPDATE public.lines 
SET machine_type = 'transfer_2000t'::public.machine_type 
WHERE (LOWER(name) LIKE '%2000%' OR LOWER(name) LIKE '%transfer 2000%') AND machine_type IS NULL;

UPDATE public.lines 
SET machine_type = 'transfer_800t'::public.machine_type 
WHERE (LOWER(name) LIKE '%800%' OR LOWER(name) LIKE '%transfer 800%') AND machine_type IS NULL;

UPDATE public.lines 
SET machine_type = 'pc200t'::public.machine_type 
WHERE (LOWER(name) LIKE '%pc200%' OR LOWER(name) LIKE '%pc 200%') AND machine_type IS NULL;
