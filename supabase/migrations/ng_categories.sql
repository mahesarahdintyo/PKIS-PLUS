-- Migration: Create ng_categories table
-- Run this in your Supabase SQL Editor

-- Drop existing table if re-running (clean slate)
DROP TABLE IF EXISTS public.ng_categories CASCADE;

-- Create table
CREATE TABLE public.ng_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.ng_categories ENABLE ROW LEVEL SECURITY;

-- Policy: semua orang (termasuk operator) bisa membaca kategori NG
DROP POLICY IF EXISTS "Allow public read ng_categories" ON public.ng_categories;
CREATE POLICY "Allow public read ng_categories" ON public.ng_categories
  FOR SELECT USING (true);

-- Policy: user terautentikasi (admin) bisa menambah kategori NG
DROP POLICY IF EXISTS "Allow authenticated insert ng_categories" ON public.ng_categories;
CREATE POLICY "Allow authenticated insert ng_categories" ON public.ng_categories
  FOR INSERT WITH CHECK (true);

-- Policy: user terautentikasi (admin) bisa menghapus kategori NG
DROP POLICY IF EXISTS "Allow authenticated delete ng_categories" ON public.ng_categories;
CREATE POLICY "Allow authenticated delete ng_categories" ON public.ng_categories
  FOR DELETE USING (true);

-- Optional: seed beberapa kategori awal (hapus komentar jika ingin langsung diisi)
-- INSERT INTO public.ng_categories (name, description) VALUES
--   ('Dimensi', 'Cacat dimensi / ukuran tidak sesuai'),
--   ('Permukaan', 'Cacat pada permukaan produk'),
--   ('Material', 'Cacat material / bahan baku'),
--   ('Proses', 'Kesalahan proses produksi'),
--   ('Lainnya', 'Kategori lainnya')
-- ON CONFLICT (name) DO NOTHING;

