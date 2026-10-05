-- =====================================================================
-- MIGRATION: Add prod_productivity_trend_bucketed RPC
-- Digunakan oleh dashboard Visualisasi Internal untuk menampilkan:
--   - Productivity Per Tanggal / Per Bulan / Per Jam (chart tren)
--   - Productivity Akumulasi (chart kumulatif)
--   - Productivity Capaian Hari Ini (card ringkasan)
--
-- Logika:
--   EH (Earned Hours) diambil dari productivity_daily_reference.eh_jam (dikali 60 jadi menit)
--   WH (Working Hours) dihitung dari prod_attendance_log:
--     hadir x 750 menit (12.5 jam per shift) + overtime_jam x 60 menit
--   PEFF = EH / WH
--   Man Hours = total_orang x 750 menit
--   GAP = Man Hours - WH
--
-- Parameter:
--   p_start  : timestamptz  awal range (inclusive)
--   p_end    : timestamptz  akhir range (exclusive)
--   p_bucket : text         'hour' atau 'day' atau 'month'
-- =====================================================================

create or replace function public.prod_productivity_trend_bucketed(
  p_start  timestamptz,
  p_end    timestamptz,
  p_bucket text
)
returns table(
  bucket_start          timestamptz,
  eh_menit              numeric,
  wh_menit              numeric,
  total_man_hours_menit numeric,
  gap_menit             numeric,
  peff                  numeric,
  sumber                text
)
language sql stable as $$
  with
  attendance_by_date as (
    select
      tanggal,
      coalesce(sum(hadir), 0) * 750 + coalesce(sum(overtime_jam), 0) * 60  as wh_menit,
      coalesce(sum(total_orang), 0) * 750                                   as total_man_hours_menit
    from public.prod_attendance_log
    where is_active = true
      and tanggal >= (p_start at time zone 'Asia/Jakarta')::date
      and tanggal <  (p_end at time zone 'Asia/Jakarta')::date
    group by tanggal
  ),
  eh_by_date as (
    select
      tanggal,
      coalesce(eh_jam, 0) * 60 as eh_menit
    from public.productivity_daily_reference
    where is_active = true
      and tanggal >= (p_start at time zone 'Asia/Jakarta')::date
      and tanggal <  (p_end at time zone 'Asia/Jakarta')::date
  ),
  daily as (
    select
      coalesce(e.tanggal, a.tanggal)        as tanggal,
      coalesce(e.eh_menit, 0)               as eh_menit,
      coalesce(a.wh_menit, 0)               as wh_menit,
      coalesce(a.total_man_hours_menit, 0)  as total_man_hours_menit
    from eh_by_date e
    full outer join attendance_by_date a on a.tanggal = e.tanggal
  ),
  bucketed as (
    select
      (date_trunc(
        case when p_bucket = 'hour' then 'day' else p_bucket end,
        tanggal
      ))::timestamp at time zone 'Asia/Jakarta' as bucket_start,
      sum(eh_menit)               as eh_menit,
      sum(wh_menit)               as wh_menit,
      sum(total_man_hours_menit)  as total_man_hours_menit
    from daily
    group by 1
  )
  select
    bucket_start,
    round(eh_menit, 2)              as eh_menit,
    round(wh_menit, 2)              as wh_menit,
    round(total_man_hours_menit, 2) as total_man_hours_menit,
    round(total_man_hours_menit - wh_menit, 2) as gap_menit,
    case when wh_menit > 0 then round(eh_menit / wh_menit, 4) else 0 end as peff,
    'historis'::text as sumber
  from bucketed
  order by bucket_start;
$$;
