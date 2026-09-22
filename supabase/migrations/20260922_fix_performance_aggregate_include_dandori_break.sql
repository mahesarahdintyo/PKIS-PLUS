-- ==============================================================================
-- MIGRATION: Fix prod_performance_aggregate — include break_menit from prod_dandori_log
-- Sebelumnya, RPC ini hanya menjumlahkan break_menit dari prod_production_log.
-- Kolom break_menit pada prod_dandori_log (non-produksi) ditambahkan pada 20260919
-- namun tidak pernah diikutsertakan dalam kalkulasi performance.
-- Fix ini menambahkan sub-query untuk dandori break dan menggabungkannya ke total break_menit.
-- ==============================================================================

create or replace function public.prod_performance_aggregate(
  p_mesin machine_type,
  p_stasiun_list text[],
  p_start timestamptz,
  p_end timestamptz
)
returns table(
  stroke numeric,
  ng numeric,
  ng_value numeric,
  dandori_menit numeric,
  downtime_menit numeric,
  break_menit numeric,
  wh_menit numeric,
  jumlah_baris bigint,
  target_std_menit numeric
)
language sql stable as $$
  with rows_with_ratio as (
    select pl.*, coalesce(pn.stroke_ratio, 1) as ratio, pn.std_ct, pn.harga_pcs
    from public.prod_production_log pl
    left join public.prod_part_numbers pn
      on pn.mesin = pl.mesin and pn.value = pl.part_number
    where pl.mesin = p_mesin
      and pl.is_active = true
      and (p_stasiun_list is null or pl.stasiun = any(p_stasiun_list))
      and pl.waktu_awal >= p_start
      and pl.waktu_awal < p_end
  ),
  batched_time as (
    select
      stasiun, waktu_awal, waktu_akhir,
      max(coalesce(break_menit, 0)) as break_menit,
      max(coalesce(dandori_menit, 0)) as dandori_menit,
      sum(coalesce(downtime_menit, 0)) as downtime_menit
    from rows_with_ratio
    group by stasiun, waktu_awal, waktu_akhir
  ),
  -- [FIX] Jumlahkan break_menit dari prod_dandori_log (non-produksi)
  -- yang sebelumnya tidak diikutsertakan dalam kalkulasi performance.
  dandori_break as (
    select coalesce(sum(coalesce(break_menit, 0)), 0) as total_break_menit
    from public.prod_dandori_log
    where mesin = p_mesin
      and is_active = true
      and (p_stasiun_list is null or stasiun = any(p_stasiun_list))
      and waktu_awal >= p_start
      and waktu_awal < p_end
      and coalesce(break_menit, 0) > 0
  )
  select
    (select coalesce(sum(coalesce(qty, 0) * ratio), 0) from rows_with_ratio),
    (select coalesce(sum(ng), 0) from rows_with_ratio),
    (select coalesce(sum(coalesce(ng,0) * coalesce(harga_pcs,0)), 0) from rows_with_ratio),
    (select coalesce(sum(dandori_menit), 0) from batched_time),
    (select coalesce(sum(downtime_menit), 0) from batched_time),
    -- break_menit = dari prod_production_log + dari prod_dandori_log
    (select coalesce(sum(break_menit), 0) from batched_time)
    + (select total_break_menit from dandori_break),
    (select coalesce(sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60), 0)
       - (select coalesce(sum(break_menit), 0) from batched_time)
     from batched_time),
    (select count(*) from rows_with_ratio),
    (select coalesce(sum(coalesce(qty, 0) * ratio * std_ct), 0) from rows_with_ratio where std_ct is not null and std_ct > 0);
$$;

-- Beritahu PostgREST untuk memuat ulang schema cache
NOTIFY pgrst, 'reload schema';
