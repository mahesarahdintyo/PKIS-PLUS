-- =====================================================================
-- MIGRATION: Add prod_downtime_trend_bucketed RPC
-- Digunakan oleh dashboard Visualisasi Internal untuk menampilkan:
--   - Downtime Exhaust  : tren total downtime per bucket (hour/day/month)
--   - Downtime Harian   : total downtime per hari dalam periode
-- Parameter:
--   p_start  : timestamptz — awal range
--   p_end    : timestamptz — akhir range (exclusive)
--   p_bucket : text       — 'hour' | 'day' | 'month'
-- =====================================================================

create or replace function public.prod_downtime_trend_bucketed(
  p_start  timestamptz,
  p_end    timestamptz,
  p_bucket text
)
returns table(
  bucket_start timestamptz,
  total_menit  numeric
)
language sql stable as $$
  select
    date_trunc(p_bucket, waktu_awal at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta' as bucket_start,
    sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60)                                  as total_menit
  from public.prod_downtime_log
  where is_active = true
    and waktu_awal >= p_start
    and waktu_awal <  p_end
  group by date_trunc(p_bucket, waktu_awal at time zone 'Asia/Jakarta')
  order by bucket_start;
$$;
