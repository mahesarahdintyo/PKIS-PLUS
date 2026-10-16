-- ============================================================
-- PKIS-PLUS: Stored Functions untuk Dashboard Produksi
-- Jalankan di PostgreSQL setelah `prisma db push`
-- PC A (Server Lokal):
--   psql -U postgres -d pkis_plus -f create_prod_functions.sql
-- ============================================================

-- 1. prod_attendance_summary (support filter shift opsional)
CREATE OR REPLACE FUNCTION prod_attendance_summary(p_start date, p_end date, p_shift text DEFAULT NULL)
RETURNS TABLE(total_orang numeric, hadir numeric, cuti numeric, absen numeric, overtime_jam numeric, jumlah_hari bigint)
LANGUAGE sql STABLE AS $$
  SELECT 
    COALESCE(SUM(total_orang), 0), 
    COALESCE(SUM(hadir), 0), 
    COALESCE(SUM(cuti), 0), 
    COALESCE(SUM(absen), 0), 
    COALESCE(SUM(overtime_jam), 0), 
    COUNT(DISTINCT tanggal)
  FROM prod_attendance_log
  WHERE is_active = true 
    AND tanggal >= p_start 
    AND tanggal < p_end
    AND (p_shift IS NULL OR shift = p_shift);
$$;

-- 2. prod_safety_summary
CREATE OR REPLACE FUNCTION prod_safety_summary(p_start date, p_end date)
RETURNS TABLE(accident_count bigint, hari_tanpa_accident integer)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_acc bigint; v_last date; v_hari integer;
BEGIN
  SELECT COUNT(*) INTO v_acc FROM prod_safety_log
  WHERE is_active = true AND kategori = 'ACCIDENT' AND tanggal >= p_start AND tanggal < p_end;
  
  SELECT MAX(tanggal) INTO v_last FROM prod_safety_log 
  WHERE is_active = true AND kategori = 'ACCIDENT';
  
  IF v_last IS NULL THEN 
    v_hari := GREATEST(0, (p_end - p_start)::integer);
  ELSE 
    v_hari := GREATEST(0, (p_end - v_last - 1)::integer); 
  END IF;
  
  RETURN QUERY SELECT v_acc, v_hari;
END;$$;

-- 3. prod_performance_aggregate
CREATE OR REPLACE FUNCTION prod_performance_aggregate(p_mesin text, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
RETURNS TABLE(stroke numeric, ng numeric, ng_value numeric, wh_menit numeric, downtime_menit numeric, dandori_menit numeric, target_std_menit numeric)
LANGUAGE sql STABLE AS $$
  WITH prod AS (
    SELECT 
      COALESCE(SUM(COALESCE(qty, 0) + COALESCE(ng, 0)), 0) AS stroke,
      COALESCE(SUM(COALESCE(ng, 0)), 0) AS ng,
      0::numeric AS ng_value,
      COALESCE(SUM(CASE WHEN waktu_akhir IS NOT NULL THEN EXTRACT(EPOCH FROM (waktu_akhir - waktu_awal))/60 ELSE 0 END), 0) AS wh_menit,
      0::numeric AS target_std_menit
    FROM prod_production_log 
    WHERE is_active = true AND mesin = p_mesin
      AND (p_stasiun_list IS NULL OR stasiun = ANY(p_stasiun_list))
      AND waktu_awal >= p_start AND waktu_awal < p_end
  ), dt AS (
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (waktu_akhir - waktu_awal))/60), 0) AS downtime_menit
    FROM prod_downtime_log 
    WHERE is_active = true AND mesin = p_mesin
      AND (p_stasiun_list IS NULL OR stasiun = ANY(p_stasiun_list))
      AND waktu_awal >= p_start AND waktu_awal < p_end
  ), dandori AS (
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(waktu_akhir, waktu_awal) - waktu_awal))/60) - COALESCE(SUM(break_menit), 0), 0) AS dandori_menit
    FROM prod_dandori_log 
    WHERE is_active = true AND mesin = p_mesin
      AND (p_stasiun_list IS NULL OR stasiun = ANY(p_stasiun_list))
      AND waktu_awal >= p_start AND waktu_awal < p_end
  )
  SELECT prod.stroke, prod.ng, prod.ng_value, prod.wh_menit, dt.downtime_menit, dandori.dandori_menit, prod.target_std_menit 
  FROM prod, dt, dandori;
$$;

-- 4. prod_downtime_top_problems
CREATE OR REPLACE FUNCTION prod_downtime_top_problems(p_mesin text, p_stasiun_list text[], p_start timestamptz, p_end timestamptz, p_limit integer DEFAULT 5)
RETURNS TABLE(kategori text, problem text, total_menit numeric)
LANGUAGE sql STABLE AS $$
  SELECT 
    COALESCE(kategori, 'MESIN') AS kategori, 
    COALESCE(problem, '-') AS problem, 
    ROUND(SUM(EXTRACT(EPOCH FROM (waktu_akhir - waktu_awal))/60), 1) AS total_menit
  FROM prod_downtime_log 
  WHERE is_active = true AND mesin = p_mesin
    AND (p_stasiun_list IS NULL OR stasiun = ANY(p_stasiun_list))
    AND waktu_awal >= p_start AND waktu_awal < p_end
  GROUP BY kategori, problem 
  ORDER BY total_menit DESC 
  LIMIT p_limit;
$$;

-- 5. prod_downtime_by_category
CREATE OR REPLACE FUNCTION prod_downtime_by_category(p_mesin text, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
RETURNS TABLE(kategori text, total_menit numeric)
LANGUAGE sql STABLE AS $$
  SELECT 
    COALESCE(kategori, 'OTHER') AS kategori, 
    ROUND(SUM(EXTRACT(EPOCH FROM (waktu_akhir - waktu_awal))/60), 1) AS total_menit
  FROM prod_downtime_log 
  WHERE is_active = true AND mesin = p_mesin
    AND (p_stasiun_list IS NULL OR stasiun = ANY(p_stasiun_list))
    AND waktu_awal >= p_start AND waktu_awal < p_end
  GROUP BY kategori 
  ORDER BY total_menit DESC;
$$;

-- 6. prod_gsph_hourly
CREATE OR REPLACE FUNCTION prod_gsph_hourly(p_mesin text, p_start timestamptz, p_end timestamptz)
RETURNS TABLE(jam integer, gsph numeric)
LANGUAGE sql STABLE AS $$
  SELECT EXTRACT(HOUR FROM waktu_awal AT TIME ZONE 'Asia/Jakarta')::integer AS jam,
    CASE WHEN SUM(EXTRACT(EPOCH FROM (COALESCE(waktu_akhir, waktu_awal) - waktu_awal))/3600) > 0
         THEN ROUND(SUM(COALESCE(qty, 0) + COALESCE(ng, 0)) / SUM(EXTRACT(EPOCH FROM (COALESCE(waktu_akhir, waktu_awal) - waktu_awal))/3600), 1)
         ELSE 0 END AS gsph
  FROM prod_production_log 
  WHERE is_active = true AND mesin = p_mesin AND waktu_awal >= p_start AND waktu_awal < p_end
  GROUP BY 1 ORDER BY 1;
$$;

-- 7. prod_gsph_trend_bucketed
CREATE OR REPLACE FUNCTION prod_gsph_trend_bucketed(p_mesin text, p_start timestamptz, p_end timestamptz, p_bucket text)
RETURNS TABLE(bucket_start timestamptz, gsph numeric)
LANGUAGE sql STABLE AS $$
  SELECT date_trunc(p_bucket, waktu_awal AT TIME ZONE 'Asia/Jakarta')::timestamp AT TIME ZONE 'Asia/Jakarta' AS bucket_start,
    CASE WHEN SUM(EXTRACT(EPOCH FROM (COALESCE(waktu_akhir, waktu_awal) - waktu_awal))/3600) > 0
         THEN ROUND(SUM(COALESCE(qty, 0) + COALESCE(ng, 0)) / SUM(EXTRACT(EPOCH FROM (COALESCE(waktu_akhir, waktu_awal) - waktu_awal))/3600), 1)
         ELSE 0 END AS gsph
  FROM prod_production_log 
  WHERE is_active = true AND mesin = p_mesin AND waktu_awal >= p_start AND waktu_awal < p_end
  GROUP BY 1 ORDER BY 1;
$$;

-- 8. prod_downtime_trend_bucketed
CREATE OR REPLACE FUNCTION prod_downtime_trend_bucketed(p_start timestamptz, p_end timestamptz, p_bucket text)
RETURNS TABLE(bucket_start timestamptz, total_menit numeric)
LANGUAGE sql STABLE AS $$
  SELECT date_trunc(p_bucket, waktu_awal AT TIME ZONE 'Asia/Jakarta')::timestamp AT TIME ZONE 'Asia/Jakarta' AS bucket_start,
    ROUND(SUM(EXTRACT(EPOCH FROM (waktu_akhir - waktu_awal))/60), 1) AS total_menit
  FROM prod_downtime_log 
  WHERE is_active = true AND waktu_awal >= p_start AND waktu_awal < p_end
  GROUP BY 1 ORDER BY 1;
$$;

-- 9. prod_productivity_trend_bucketed
CREATE OR REPLACE FUNCTION prod_productivity_trend_bucketed(p_start timestamptz, p_end timestamptz, p_bucket text)
RETURNS TABLE(bucket_start timestamptz, eh_menit numeric, wh_menit numeric, total_man_hours_menit numeric, gap_menit numeric, peff numeric, sumber text)
LANGUAGE sql STABLE AS $$
  WITH attendance_by_date AS (
    SELECT tanggal,
      COALESCE(SUM(hadir), 0) * 750 + COALESCE(SUM(overtime_jam), 0) * 60 AS wh_menit,
      COALESCE(SUM(total_orang), 0) * 750 AS total_man_hours_menit
    FROM prod_attendance_log 
    WHERE is_active = true
      AND tanggal >= (p_start AT TIME ZONE 'Asia/Jakarta')::date
      AND tanggal <  (p_end   AT TIME ZONE 'Asia/Jakarta')::date
    GROUP BY tanggal
  ), eh_by_date AS (
    SELECT tanggal, COALESCE(eh_jam, 0) * 60 AS eh_menit
    FROM productivity_daily_reference 
    WHERE is_active = true
      AND tanggal >= (p_start AT TIME ZONE 'Asia/Jakarta')::date
      AND tanggal <  (p_end   AT TIME ZONE 'Asia/Jakarta')::date
  ), daily AS (
    SELECT COALESCE(e.tanggal, a.tanggal) AS tanggal,
      COALESCE(e.eh_menit, 0) AS eh_menit, 
      COALESCE(a.wh_menit, 0) AS wh_menit,
      COALESCE(a.total_man_hours_menit, 0) AS total_man_hours_menit
    FROM eh_by_date e FULL OUTER JOIN attendance_by_date a ON a.tanggal = e.tanggal
  ), bucketed AS (
    SELECT (date_trunc(CASE WHEN p_bucket = 'hour' THEN 'day' ELSE p_bucket END, tanggal))::timestamp AT TIME ZONE 'Asia/Jakarta' AS bucket_start,
      SUM(eh_menit) AS eh_menit, SUM(wh_menit) AS wh_menit, SUM(total_man_hours_menit) AS total_man_hours_menit
    FROM daily GROUP BY 1
  )
  SELECT bucket_start, ROUND(eh_menit, 2), ROUND(wh_menit, 2), ROUND(total_man_hours_menit, 2),
    ROUND(total_man_hours_menit - wh_menit, 2),
    CASE WHEN wh_menit > 0 THEN ROUND(eh_menit / wh_menit, 4) ELSE 0 END,
    'historis'::text
  FROM bucketed ORDER BY bucket_start;
$$;

-- 10. prod_achievement_aggregate
CREATE OR REPLACE FUNCTION prod_achievement_aggregate(p_mesin text, p_start timestamptz, p_end timestamptz)
RETURNS TABLE(qty_rencana numeric, qty_aktual numeric)
LANGUAGE sql STABLE AS $$
  WITH plan AS (
    SELECT COALESCE(SUM(qty_rencana), 0) AS rencana
    FROM prod_production_planning
    WHERE is_active = true AND mesin = p_mesin
      AND jam_rencana_mulai >= p_start AND jam_rencana_mulai < p_end
  ),
  act AS (
    SELECT COALESCE(SUM(qty), 0) AS aktual
    FROM prod_production_log
    WHERE is_active = true AND mesin = p_mesin
      AND waktu_awal >= p_start AND waktu_awal < p_end
  )
  SELECT plan.rencana, act.aktual FROM plan, act;
$$;

-- 11. prod_scrap_top_end_summary
CREATE OR REPLACE FUNCTION prod_scrap_top_end_summary(p_start date, p_end date)
RETURNS TABLE(scrap_value_kidr numeric, rasio numeric, target_rasio numeric)
LANGUAGE sql STABLE AS $$
  SELECT 
    COALESCE(SUM(scrap_value_kidr), 0),
    CASE WHEN SUM(total_value_kidr) > 0 
      THEN ROUND((SUM(scrap_value_kidr) / SUM(total_value_kidr)) * 100, 2)
      ELSE 0 
    END,
    COALESCE(AVG(target_rasio), 0)
  FROM prod_scrap_top_end
  WHERE is_active = true
    AND make_date(tahun, bulan, 1) >= date_trunc('month', p_start)::date
    AND make_date(tahun, bulan, 1) < p_end;
$$;

-- ============================================================
-- Selesai.
-- ============================================================
