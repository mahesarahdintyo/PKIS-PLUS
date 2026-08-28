-- ==========================================================================
-- Perketat RLS policy UPDATE dan DELETE pada tabel prod_production_log
-- dan prod_dandori_log: hanya admin/leader yang diizinkan.
-- SELECT dan INSERT tetap terbuka untuk semua authenticated user (operator
-- masih perlu insert data produksi baru dan melihat riwayat).
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. prod_production_log
-- --------------------------------------------------------------------------

-- Hapus policy UPDATE dan DELETE yang lama (to authenticated using (true))
DROP POLICY IF EXISTS "Login bisa update prod_production_log" ON public.prod_production_log;
DROP POLICY IF EXISTS "Login bisa hapus prod_production_log"  ON public.prod_production_log;

-- Buat policy UPDATE baru: hanya admin/leader
CREATE POLICY "Admin/Leader bisa update prod_production_log"
  ON public.prod_production_log FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- Buat policy DELETE baru: hanya admin/leader
CREATE POLICY "Admin/Leader bisa hapus prod_production_log"
  ON public.prod_production_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- --------------------------------------------------------------------------
-- 2. prod_dandori_log
-- --------------------------------------------------------------------------

-- Hapus policy UPDATE dan DELETE yang lama (to authenticated using (true))
DROP POLICY IF EXISTS "Login bisa update prod_dandori_log" ON public.prod_dandori_log;
DROP POLICY IF EXISTS "Login bisa hapus prod_dandori_log"  ON public.prod_dandori_log;

-- Buat policy UPDATE baru: hanya admin/leader
CREATE POLICY "Admin/Leader bisa update prod_dandori_log"
  ON public.prod_dandori_log FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );

-- Buat policy DELETE baru: hanya admin/leader
CREATE POLICY "Admin/Leader bisa hapus prod_dandori_log"
  ON public.prod_dandori_log FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'leader')
    )
  );
