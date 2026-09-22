CREATE TABLE IF NOT EXISTS public.part_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE public.part_numbers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'part_numbers' AND policyname = 'Allow public read part_numbers'
  ) THEN
    CREATE POLICY "Allow public read part_numbers" ON public.part_numbers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'part_numbers' AND policyname = 'Allow authenticated insert part_numbers'
  ) THEN
    CREATE POLICY "Allow authenticated insert part_numbers" ON public.part_numbers FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'part_numbers' AND policyname = 'Allow authenticated delete part_numbers'
  ) THEN
    CREATE POLICY "Allow authenticated delete part_numbers" ON public.part_numbers FOR DELETE USING (true);
  END IF;
END $$;
