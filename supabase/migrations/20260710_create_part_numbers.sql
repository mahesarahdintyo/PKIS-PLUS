-- Hapus tabel lama jika ada agar bersih (clean slate)
DROP TABLE IF EXISTS public.part_numbers CASCADE;

-- Membuat tabel part_numbers
CREATE TABLE public.part_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.part_numbers ENABLE ROW LEVEL SECURITY;

-- Policy agar semua orang (termasuk operator) bisa melihat data part numbers
DROP POLICY IF EXISTS "Allow public read part_numbers" ON public.part_numbers;
CREATE POLICY "Allow public read part_numbers" ON public.part_numbers
  FOR SELECT USING (true);

-- Policy agar user terautentikasi (admin) yang bisa menambah/menghapus
DROP POLICY IF EXISTS "Allow authenticated insert part_numbers" ON public.part_numbers;
CREATE POLICY "Allow authenticated insert part_numbers" ON public.part_numbers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete part_numbers" ON public.part_numbers;
CREATE POLICY "Allow authenticated delete part_numbers" ON public.part_numbers
  FOR DELETE USING (true);

-- Menyisipkan data awal
INSERT INTO public.part_numbers (code, description) VALUES
  ('FTB-001-A', 'Part number standard tipe A'),
  ('FTB-002-B', 'Part number standard tipe B'),
  ('FTB-003-C', 'Part number standard tipe C')
ON CONFLICT (code) DO NOTHING;
