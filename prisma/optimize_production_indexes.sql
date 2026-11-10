-- ==============================================================================
-- OPTIMASI INDEKS & SINKRONISASI LINE ID UNTUK LAPORAN PRODUKSI & RIWAYAT LOG
-- Jalankan file ini di PostgreSQL / DBeaver pada server kantor / lokal
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SINKRONISASI / BACKFILL line_id PADA LOG HISTORIS
-- Menghubungkan baris prod_production_log, prod_dandori_log, & prod_downtime_log
-- yang line_id nya masih NULL dengan ID yang sesuai di tabel lines.
-- ------------------------------------------------------------------------------

-- 1.1 prod_production_log
UPDATE prod_production_log pl
SET line_id = l.id
FROM lines l
WHERE pl.line_id IS NULL
  AND (
    (LOWER(pl.mesin::text) LIKE '%tandem%' OR LOWER(pl.mesin::text) LIKE '%tdm%')
      AND (LOWER(l.name) LIKE '%tandem%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%tandem%')
    OR (LOWER(pl.mesin::text) LIKE '%blank%' OR LOWER(pl.mesin::text) = 'blk')
      AND (LOWER(l.name) LIKE '%blank%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%blank%')
    OR (LOWER(pl.mesin::text) LIKE '%2000%' OR LOWER(pl.mesin::text) = 'tr2')
      AND (LOWER(l.name) LIKE '%2000%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%2000%')
    OR (LOWER(pl.mesin::text) LIKE '%800%' OR LOWER(pl.mesin::text) = 'tr8')
      AND (LOWER(l.name) LIKE '%800%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%800%')
    OR ((LOWER(pl.mesin::text) LIKE '%200%' AND LOWER(pl.mesin::text) NOT LIKE '%2000%') OR LOWER(pl.mesin::text) = 'pc2')
      AND ((LOWER(l.name) LIKE '%200%' AND LOWER(l.name) NOT LIKE '%2000%') OR (LOWER(COALESCE(l.machine_type, '')) LIKE '%200%' AND LOWER(COALESCE(l.machine_type, '')) NOT LIKE '%2000%'))
  );

-- 1.2 prod_dandori_log
UPDATE prod_dandori_log dl
SET line_id = l.id
FROM lines l
WHERE dl.line_id IS NULL
  AND (
    (LOWER(dl.mesin::text) LIKE '%tandem%' OR LOWER(dl.mesin::text) LIKE '%tdm%')
      AND (LOWER(l.name) LIKE '%tandem%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%tandem%')
    OR (LOWER(dl.mesin::text) LIKE '%blank%' OR LOWER(dl.mesin::text) = 'blk')
      AND (LOWER(l.name) LIKE '%blank%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%blank%')
    OR (LOWER(dl.mesin::text) LIKE '%2000%' OR LOWER(dl.mesin::text) = 'tr2')
      AND (LOWER(l.name) LIKE '%2000%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%2000%')
    OR (LOWER(dl.mesin::text) LIKE '%800%' OR LOWER(dl.mesin::text) = 'tr8')
      AND (LOWER(l.name) LIKE '%800%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%800%')
    OR ((LOWER(dl.mesin::text) LIKE '%200%' AND LOWER(dl.mesin::text) NOT LIKE '%2000%') OR LOWER(dl.mesin::text) = 'pc2')
      AND ((LOWER(l.name) LIKE '%200%' AND LOWER(l.name) NOT LIKE '%2000%') OR (LOWER(COALESCE(l.machine_type, '')) LIKE '%200%' AND LOWER(COALESCE(l.machine_type, '')) NOT LIKE '%2000%'))
  );

-- 1.3 prod_downtime_log
UPDATE prod_downtime_log dtl
SET line_id = l.id
FROM lines l
WHERE dtl.line_id IS NULL
  AND (
    (LOWER(dtl.mesin::text) LIKE '%tandem%' OR LOWER(dtl.mesin::text) LIKE '%tdm%')
      AND (LOWER(l.name) LIKE '%tandem%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%tandem%')
    OR (LOWER(dtl.mesin::text) LIKE '%blank%' OR LOWER(dtl.mesin::text) = 'blk')
      AND (LOWER(l.name) LIKE '%blank%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%blank%')
    OR (LOWER(dtl.mesin::text) LIKE '%2000%' OR LOWER(dtl.mesin::text) = 'tr2')
      AND (LOWER(l.name) LIKE '%2000%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%2000%')
    OR (LOWER(dtl.mesin::text) LIKE '%800%' OR LOWER(dtl.mesin::text) = 'tr8')
      AND (LOWER(l.name) LIKE '%800%' OR LOWER(COALESCE(l.machine_type, '')) LIKE '%800%')
    OR ((LOWER(dtl.mesin::text) LIKE '%200%' AND LOWER(dtl.mesin::text) NOT LIKE '%2000%') OR LOWER(dtl.mesin::text) = 'pc2')
      AND ((LOWER(l.name) LIKE '%200%' AND LOWER(l.name) NOT LIKE '%2000%') OR (LOWER(COALESCE(l.machine_type, '')) LIKE '%200%' AND LOWER(COALESCE(l.machine_type, '')) NOT LIKE '%2000%'))
  );

-- ------------------------------------------------------------------------------
-- 2. INDEXING CEPAT & ANTI-HANG (B-TREE INDEXES)
-- Membuat query pagination, sorting tanggal, dan filter line menjadi secepat kilat (1-5ms)
-- ------------------------------------------------------------------------------

-- Indexes untuk prod_production_log
CREATE INDEX IF NOT EXISTS idx_prod_production_log_waktu_awal ON prod_production_log (waktu_awal DESC);
CREATE INDEX IF NOT EXISTS idx_prod_production_log_mesin ON prod_production_log (mesin);
CREATE INDEX IF NOT EXISTS idx_prod_production_log_line_id ON prod_production_log (line_id);
CREATE INDEX IF NOT EXISTS idx_prod_production_log_active_waktu ON prod_production_log (is_active, waktu_awal DESC);

-- Indexes untuk prod_dandori_log
CREATE INDEX IF NOT EXISTS idx_prod_dandori_log_waktu_awal ON prod_dandori_log (waktu_awal DESC);
CREATE INDEX IF NOT EXISTS idx_prod_dandori_log_mesin ON prod_dandori_log (mesin);
CREATE INDEX IF NOT EXISTS idx_prod_dandori_log_line_id ON prod_dandori_log (line_id);
CREATE INDEX IF NOT EXISTS idx_prod_dandori_log_active_waktu ON prod_dandori_log (is_active, waktu_awal DESC);

-- Indexes untuk prod_downtime_log
CREATE INDEX IF NOT EXISTS idx_prod_downtime_log_waktu_awal ON prod_downtime_log (waktu_awal DESC);
CREATE INDEX IF NOT EXISTS idx_prod_downtime_log_mesin ON prod_downtime_log (mesin);
CREATE INDEX IF NOT EXISTS idx_prod_downtime_log_line_id ON prod_downtime_log (line_id);
CREATE INDEX IF NOT EXISTS idx_prod_downtime_log_prod_id ON prod_downtime_log (production_log_id);

-- ------------------------------------------------------------------------------
-- 3. VERIFIKASI JUMLAH DATA PER LINE
-- ------------------------------------------------------------------------------
SELECT 
  COALESCE(l.name, 'Line ID Belum Terpasang') AS nama_line,
  pl.mesin,
  COUNT(*) AS total_log_produksi,
  MIN(pl.waktu_awal)::date AS tanggal_terlama,
  MAX(pl.waktu_awal)::date AS tanggal_terbaru
FROM prod_production_log pl
LEFT JOIN lines l ON l.id = pl.line_id
WHERE COALESCE(pl.is_active, true) = true
GROUP BY l.name, pl.mesin
ORDER BY total_log_produksi DESC;

