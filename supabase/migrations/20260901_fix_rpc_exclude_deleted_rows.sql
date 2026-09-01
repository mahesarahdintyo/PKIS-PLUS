-- ==============================================================================
-- MIGRATION: Semua fungsi RPC dashboard supaya kecualikan data yang sudah
-- di-soft-delete (is_active = false)
-- ==============================================================================
-- Root cause: 11 fungsi RPC ini ditulis di 0001_add_production_system.sql,
-- SEBELUM kolom is_active/Recycle Bin ditambahkan (20260717). Tidak pernah
-- diupdate lagi setelahnya -- jadi data yang sudah dihapus di halaman admin
-- (Downtime Log, Input Safety, dst) tetap ikut terhitung di Dashboard.

create or replace function public.prod_achievement_aggregate(p_mesin machine_type, p_start timestamptz, p_end timestamptz)
returns table(qty_rencana numeric, qty_aktual numeric)
language sql stable as $$
  select
    coalesce(sum(pp.qty_rencana), 0),
    coalesce(sum(
      case when pp.actual_production_id is not null then
        (select coalesce(pl.qty,0) * coalesce(pn.stroke_ratio,1)
         from public.prod_production_log pl
         left join public.prod_part_numbers pn on pn.mesin = pl.mesin and pn.value = pl.part_number
         where pl.id = pp.actual_production_id and pl.is_active = true)
      else 0 end
    ), 0)
  from public.prod_production_planning pp
  where pp.mesin = p_mesin
    and pp.is_active = true
    and pp.jam_rencana_mulai >= p_start and pp.jam_rencana_mulai < p_end;
$$;

create or replace function public.prod_achievement_summary(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
returns table(qty_rencana numeric, qty_aktual numeric, achievement_pct numeric)
language sql stable as $$
  with rencana as (
    select coalesce(sum(qty_rencana), 0) as total
    from public.prod_production_planning
    where mesin = p_mesin
      and is_active = true
      and (p_stasiun_list is null or stasiun = any(p_stasiun_list))
      and jam_rencana_mulai >= p_start and jam_rencana_mulai < p_end
  ),
  aktual as (
    select coalesce(sum(qty), 0) as total
    from public.prod_production_log
    where mesin = p_mesin
      and is_active = true
      and (p_stasiun_list is null or stasiun = any(p_stasiun_list))
      and waktu_awal >= p_start and waktu_awal < p_end
  )
  select
    rencana.total, aktual.total,
    case when rencana.total > 0 then (aktual.total / rencana.total) * 100 else null end
  from rencana, aktual;
$$;

create or replace function public.prod_attendance_summary(p_start date, p_end date)
returns table(total_orang numeric, hadir numeric, cuti numeric, absen numeric, overtime_jam numeric, jumlah_hari bigint)
language sql stable as $$
  select
    coalesce(sum(total_orang), 0),
    coalesce(sum(hadir), 0),
    coalesce(sum(cuti), 0),
    coalesce(sum(absen), 0),
    coalesce(sum(overtime_jam), 0),
    count(*)
  from public.prod_attendance_log
  where tanggal >= p_start
    and tanggal < p_end
    and is_active = true
    and extract(dow from tanggal) not in (0, 6);
$$;

create or replace function public.prod_downtime_by_category(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
returns table(kategori text, total_menit numeric)
language sql stable as $$
  select kategori, sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60) as total_menit
  from public.prod_downtime_log
  where mesin = p_mesin
    and is_active = true
    and (p_stasiun_list is null or stasiun = any(p_stasiun_list))
    and waktu_awal >= p_start and waktu_awal < p_end
  group by kategori
  order by total_menit desc;
$$;

create or replace function public.prod_downtime_top_problems(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz, p_limit integer default 5)
returns table(kategori text, problem text, total_menit numeric)
language sql stable as $$
  select kategori, coalesce(problem, '(tanpa keterangan)') as problem,
         sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60) as total_menit
  from public.prod_downtime_log
  where mesin = p_mesin
    and is_active = true
    and (p_stasiun_list is null or stasiun = any(p_stasiun_list))
    and waktu_awal >= p_start and waktu_awal < p_end
  group by kategori, problem
  order by total_menit desc
  limit p_limit;
$$;

create or replace function public.prod_gsph_hourly(p_mesin machine_type, p_start timestamptz, p_end timestamptz)
returns table(jam integer, stroke numeric, wh_menit numeric, gsph numeric)
language sql stable as $$
  with rows_with_ratio as (
    select pl.*, coalesce(pn.stroke_ratio, 1) as ratio,
           extract(hour from pl.waktu_awal at time zone 'Asia/Jakarta')::int as jam_mulai
    from public.prod_production_log pl
    left join public.prod_part_numbers pn
      on pn.mesin = pl.mesin and pn.value = pl.part_number
    where pl.mesin = p_mesin
      and pl.is_active = true
      and pl.waktu_awal >= p_start and pl.waktu_awal < p_end
  ),
  per_jam as (
    select
      jam_mulai as jam,
      sum(coalesce(qty,0) * ratio) as stroke,
      sum(extract(epoch from (waktu_akhir - waktu_awal))/60) - sum(coalesce(break_menit,0)) as wh_menit
    from rows_with_ratio
    group by jam_mulai
  )
  select jam, stroke, wh_menit,
         case when wh_menit > 0 then stroke / (wh_menit/60) else 0 end as gsph
  from per_jam
  order by jam;
$$;

create or replace function public.prod_gsph_trend_bucketed(p_mesin machine_type, p_start timestamptz, p_end timestamptz, p_bucket text)
returns table(bucket_start timestamptz, stroke numeric, wh_menit numeric, gsph numeric)
language sql stable as $$
  with rows_with_ratio as (
    select
      date_trunc(p_bucket, pl.waktu_awal at time zone 'Asia/Jakarta') as b,
      pl.stasiun, pl.waktu_awal, pl.waktu_akhir,
      coalesce(pl.qty, 0) * coalesce(pn.stroke_ratio, 1) as stroke,
      coalesce(pl.break_menit, 0) as break_menit
    from public.prod_production_log pl
    left join public.prod_part_numbers pn
      on pn.mesin = pl.mesin and pn.value = pl.part_number
    where pl.mesin = p_mesin
      and pl.is_active = true
      and pl.waktu_awal >= p_start
      and pl.waktu_awal < p_end
  ),
  waktu_unik as (
    select b, stasiun, waktu_awal, waktu_akhir,
           max(break_menit) as break_menit
    from rows_with_ratio
    group by b, stasiun, waktu_awal, waktu_akhir
  ),
  wh as (
    select b,
           sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60) - sum(break_menit) as wh_menit
    from waktu_unik
    group by b
  ),
  st as (
    select b, sum(stroke) as stroke
    from rows_with_ratio
    group by b
  )
  select
    st.b at time zone 'Asia/Jakarta' as bucket_start,
    st.stroke,
    coalesce(wh.wh_menit, 0) as wh_menit,
    case when coalesce(wh.wh_menit, 0) > 0
         then st.stroke / (wh.wh_menit / 60)
         else 0 end as gsph
  from st
  left join wh on wh.b = st.b
  order by st.b;
$$;

create or replace function public.prod_machine_live_status(p_start timestamptz, p_end timestamptz)
returns table(mesin machine_type, stasiun text, part_number text, waktu_awal timestamptz, waktu_akhir timestamptz, qty numeric, stroke numeric, gsph numeric, downtime_menit numeric)
language sql stable as $$
  with ranked as (
    select pl.*, coalesce(pn.stroke_ratio,1) as ratio,
           row_number() over (partition by pl.mesin, pl.stasiun order by pl.waktu_awal desc) as rn
    from public.prod_production_log pl
    left join public.prod_part_numbers pn
      on pn.mesin = pl.mesin and pn.value = pl.part_number
    where pl.is_active = true
      and pl.waktu_awal >= p_start and pl.waktu_awal < p_end
  )
  select
    mesin, stasiun, part_number, waktu_awal, waktu_akhir,
    qty,
    (coalesce(qty,0) * ratio) as stroke,
    case
      when (extract(epoch from (waktu_akhir - waktu_awal))/60 - coalesce(break_menit,0)) > 0
      then (coalesce(qty,0) * ratio) / ((extract(epoch from (waktu_akhir - waktu_awal))/60 - coalesce(break_menit,0))/60)
      else 0
    end as gsph,
    coalesce(downtime_menit, 0) as downtime_menit
  from ranked
  where rn = 1
  order by mesin, stasiun;
$$;

create or replace function public.prod_performance_aggregate(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
returns table(stroke numeric, ng numeric, ng_value numeric, dandori_menit numeric, downtime_menit numeric, break_menit numeric, wh_menit numeric, jumlah_baris bigint, target_std_menit numeric)
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
  )
  select
    (select coalesce(sum(coalesce(qty, 0) * ratio), 0) from rows_with_ratio),
    (select coalesce(sum(ng), 0) from rows_with_ratio),
    (select coalesce(sum(coalesce(ng,0) * coalesce(harga_pcs,0)), 0) from rows_with_ratio),
    (select coalesce(sum(dandori_menit), 0) from batched_time),
    (select coalesce(sum(downtime_menit), 0) from batched_time),
    (select coalesce(sum(break_menit), 0) from batched_time),
    (select coalesce(sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60), 0)
       - (select coalesce(sum(break_menit), 0) from batched_time)
     from batched_time),
    (select count(*) from rows_with_ratio),
    (select coalesce(sum(coalesce(qty, 0) * ratio * std_ct), 0) from rows_with_ratio where std_ct is not null and std_ct > 0);
$$;

create or replace function public.prod_performance_by_part(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
returns table(part_number text, qty numeric, stroke numeric, operasi_menit numeric, earned_menit numeric, gsph numeric, jumlah_baris bigint)
language sql stable as $$
  select
    pl.part_number,
    sum(coalesce(pl.qty, 0)) as qty,
    sum(coalesce(pl.qty, 0) * coalesce(pn.stroke_ratio, 1)) as stroke,
    sum(extract(epoch from (pl.waktu_akhir - pl.waktu_awal)) / 60) as operasi_menit,
    sum(coalesce(pl.qty, 0) * coalesce(pn.stroke_ratio, 1) * coalesce(pn.std_ct, 0)) as earned_menit,
    case when sum(extract(epoch from (pl.waktu_akhir - pl.waktu_awal)) / 60) > 0
      then sum(coalesce(pl.qty, 0) * coalesce(pn.stroke_ratio, 1))
           / (sum(extract(epoch from (pl.waktu_akhir - pl.waktu_awal)) / 60) / 60)
      else 0 end as gsph,
    count(*) as jumlah_baris
  from public.prod_production_log pl
  left join public.prod_part_numbers pn
    on pn.mesin = pl.mesin and pn.value = pl.part_number
  where pl.mesin = p_mesin
    and pl.is_active = true
    and (p_stasiun_list is null or pl.stasiun = any(p_stasiun_list))
    and pl.waktu_awal >= p_start and pl.waktu_awal < p_end
  group by pl.part_number
  order by stroke desc;
$$;

create or replace function public.prod_safety_summary(p_start date, p_end date)
returns table(accident_count bigint, hari_tanpa_accident integer)
language sql stable as $$
  select
    (select count(*) from public.prod_safety_log
      where tanggal >= p_start and tanggal < p_end and kategori = 'ACCIDENT' and is_active = true),
    (select coalesce(
      (current_date - max(tanggal))::integer,
      (current_date - date '2024-04-01')::integer
    ) from public.prod_safety_log where kategori = 'ACCIDENT' and is_active = true);
$$;

create or replace function public.prod_scrap_top_end_summary(p_start date, p_end date)
returns table(scrap_value_kidr numeric, total_value_kidr numeric, rasio numeric, target_rasio numeric)
language sql stable as $$
  with f as (
    select * from public.prod_scrap_top_end
    where make_date(tahun, bulan, 1) >= date_trunc('month', p_start)::date
      and make_date(tahun, bulan, 1) < p_end
      and is_active = true
  )
  select
    coalesce(sum(scrap_value_kidr), 0),
    coalesce(sum(total_value_kidr), 0),
    case when coalesce(sum(total_value_kidr),0) > 0
      then sum(scrap_value_kidr) / sum(total_value_kidr) else 0 end,
    coalesce(avg(target_rasio), 0)
  from f;
$$;
