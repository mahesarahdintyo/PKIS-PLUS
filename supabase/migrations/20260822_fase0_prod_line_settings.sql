-- ==========================================================================
-- FASE 0: Tabel prod_line_settings (pengganti MACHINE_CONFIGS hardcode)
-- Setiap line punya pengaturan produksinya sendiri, disimpan di database.
-- prod_mesin_settings (per machine_type) TIDAK dihapus — dibiarkan apa adanya.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Buat tabel prod_line_settings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prod_line_settings (
  line_id uuid PRIMARY KEY REFERENCES public.lines(id) ON DELETE CASCADE,

  -- Konfigurasi stasiun
  station_mode text NOT NULL DEFAULT 'none' CHECK (station_mode IN ('none', 'fixed', 'variant')),
  stations jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- dipakai kalau station_mode = 'fixed', array of string, mis. ["PC-1","PC-2"]
  station_variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- dipakai kalau station_mode = 'variant', object mis. {"lama":["PA-1",...],"baru":["PA-6",...]}
  routing_max integer NOT NULL DEFAULT 0,

  -- Field tambahan di form input produksi
  extra_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- array of {key, label, type: "text"|"number"}

  -- Pilihan kategori downtime
  kategori_options jsonb NOT NULL DEFAULT '["MESIN","DIES","OTHER"]'::jsonb,

  -- Target GSPH (pindahan dari prod_mesin_settings)
  gsph_target_mode text NOT NULL DEFAULT 'fixed' CHECK (gsph_target_mode IN ('fixed', 'per_part')),
  gsph_target_fixed numeric NOT NULL DEFAULT 0,

  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 2. RLS untuk prod_line_settings
-- --------------------------------------------------------------------------
ALTER TABLE public.prod_line_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Login bisa lihat prod_line_settings"
  ON public.prod_line_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Leader bisa insert prod_line_settings"
  ON public.prod_line_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

CREATE POLICY "Admin/Leader bisa update prod_line_settings"
  ON public.prod_line_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- --------------------------------------------------------------------------
-- 3. Isi baris default untuk semua line yang sudah ada
-- --------------------------------------------------------------------------
INSERT INTO public.prod_line_settings (line_id)
SELECT id FROM public.lines
ON CONFLICT (line_id) DO NOTHING;

-- --------------------------------------------------------------------------
-- 4. Trigger: setiap line baru otomatis dibuatkan baris default
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_line_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.prod_line_settings (line_id)
  VALUES (NEW.id)
  ON CONFLICT (line_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_default_line_settings ON public.lines;
CREATE TRIGGER trg_create_default_line_settings
  AFTER INSERT ON public.lines
  FOR EACH ROW EXECUTE FUNCTION public.create_default_line_settings();

-- --------------------------------------------------------------------------
-- 5. Tambah kolom line_id ke 3 tabel master produksi
--    (kolom mesin machine_type tetap ada, tidak disentuh)
-- --------------------------------------------------------------------------

-- prod_part_numbers
ALTER TABLE public.prod_part_numbers
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_part_numbers_line_id
  ON public.prod_part_numbers (line_id);

-- prod_downtime_problems
ALTER TABLE public.prod_downtime_problems
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_downtime_problems_line_id
  ON public.prod_downtime_problems (line_id);

-- prod_nonproduksi_types
ALTER TABLE public.prod_nonproduksi_types
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prod_nonproduksi_types_line_id
  ON public.prod_nonproduksi_types (line_id);
