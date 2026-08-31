-- Migration: Menambahkan kolom document_id, nama_part, dan harga_rp ke tabel prod_part_numbers
-- Memastikan part number pada modul produksi dapat terhubung dengan dokumen SOP/WI/Drawings

-- 1. Tambah kolom document_id jika belum ada
ALTER TABLE public.prod_part_numbers 
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

-- 2. Tambah kolom nama_part dan harga_rp jika belum ada
ALTER TABLE public.prod_part_numbers 
  ADD COLUMN IF NOT EXISTS nama_part TEXT,
  ADD COLUMN IF NOT EXISTS harga_rp NUMERIC;

-- 3. Tambahkan index untuk mempercepat query berdasarkan document_id
CREATE INDEX IF NOT EXISTS idx_prod_part_numbers_document_id 
  ON public.prod_part_numbers (document_id);

-- 4. Pastikan RLS mengizinkan operasi update kolom document_id
ALTER TABLE public.prod_part_numbers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'prod_part_numbers' AND policyname = 'Login bisa update prod_part_numbers'
  ) THEN
    CREATE POLICY "Login bisa update prod_part_numbers" 
      ON public.prod_part_numbers 
      FOR UPDATE 
      TO authenticated 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;
