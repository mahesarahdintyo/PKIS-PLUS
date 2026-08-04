-- =========================================================
-- MIGRATION 0001 — Add Production System (from database-main)
-- Semua tabel/fungsi/trigger dari sistem produksi stamping,
-- diprefix `prod_` supaya tidak bentrok dengan tabel/fungsi
-- Futaba yang sudah ada (terutama part_numbers dan
-- handle_new_user/on_auth_user_created).
--
-- profiles TIDAK diduplikasi — tetap pakai tabel `profiles`
-- milik Futaba sebagai satu-satunya sumber identitas user.
-- =========================================================

-- 0. Enum daftar mesin (shared, tidak bentrok dengan apapun di Futaba)
create type machine_type as enum (
  'tandem',
  'blanking',
  'transfer_2000t',
  'transfer_800t',
  'pc200t'
);

-- 0.1 Sesuaikan tabel profiles milik Futaba:
--     - tambah kolom full_name (dipakai HeaderNav project-experiment,
--       belum diisi otomatis di sini — itu kerjaan Fase 2)
--     - tambah role 'leader' (sebelumnya cuma admin/operator)
alter table public.profiles add column if not exists full_name text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['admin'::text, 'operator'::text, 'leader'::text]));

-- =========================================================
-- 1. TABEL
-- =========================================================

-- 1.1 PROD_PRODUCTION_LOG
create table public.prod_production_log (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  waktu_awal timestamptz not null,
  waktu_akhir timestamptz not null,
  part_number text,
  qty integer,
  ng integer,
  kategori_ng text,
  break_menit integer,
  stasiun text,
  extra jsonb not null default '{}'::jsonb,
  kode text,
  dandori_menit numeric default 0,
  downtime_menit numeric default 0,
  manpower numeric,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prod_production_log_kode_unique unique (kode)
);
create index idx_prod_production_log_mesin_waktu on public.prod_production_log (mesin, waktu_awal desc);
alter table public.prod_production_log enable row level security;
create policy "Login bisa lihat prod_production_log" on public.prod_production_log for select to authenticated using (true);
create policy "Login bisa tambah prod_production_log" on public.prod_production_log for insert to authenticated with check (true);
create policy "Login bisa update prod_production_log" on public.prod_production_log for update to authenticated using (true);
create policy "Login bisa hapus prod_production_log" on public.prod_production_log for delete to authenticated using (true);

-- 1.2 PROD_DOWNTIME_LOG
create table public.prod_downtime_log (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  waktu_awal timestamptz not null,
  waktu_akhir timestamptz not null,
  kategori text,
  problem text,
  penyebab text,
  countermeasure text,
  stasiun text,
  production_log_id uuid references public.prod_production_log(id) on delete cascade,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_prod_downtime_log_mesin_waktu on public.prod_downtime_log (mesin, waktu_awal desc);
alter table public.prod_downtime_log enable row level security;
create policy "Login bisa lihat prod_downtime_log" on public.prod_downtime_log for select to authenticated using (true);
create policy "Login bisa tambah prod_downtime_log" on public.prod_downtime_log for insert to authenticated with check (true);
create policy "Login bisa update prod_downtime_log" on public.prod_downtime_log for update to authenticated using (true);
create policy "Login bisa hapus prod_downtime_log" on public.prod_downtime_log for delete to authenticated using (true);

-- 1.3 PROD_PART_NUMBERS (versi produksi — beda dari part_numbers Futaba)
create table public.prod_part_numbers (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  value text not null,
  next_processes jsonb not null default '[]'::jsonb,
  output_ratio numeric not null default 1,
  stroke_ratio numeric,
  std_mp numeric,
  std_ct numeric,
  harga_pcs numeric,
  created_at timestamptz not null default now(),
  unique (mesin, value)
);
alter table public.prod_part_numbers enable row level security;
create policy "Login bisa lihat prod_part_numbers" on public.prod_part_numbers for select to authenticated using (true);
create policy "Login bisa tambah prod_part_numbers" on public.prod_part_numbers for insert to authenticated with check (true);
create policy "Login bisa hapus prod_part_numbers" on public.prod_part_numbers for delete to authenticated using (true);
create policy "Login bisa update prod_part_numbers" on public.prod_part_numbers for update to authenticated using (true) with check (true);

-- 1.4 PROD_DOWNTIME_PROBLEMS
create table public.prod_downtime_problems (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (mesin, value)
);
alter table public.prod_downtime_problems enable row level security;
create policy "Login bisa lihat prod_downtime_problems" on public.prod_downtime_problems for select to authenticated using (true);
create policy "Login bisa tambah prod_downtime_problems" on public.prod_downtime_problems for insert to authenticated with check (true);
create policy "Login bisa hapus prod_downtime_problems" on public.prod_downtime_problems for delete to authenticated using (true);
create policy "Login bisa update prod_downtime_problems" on public.prod_downtime_problems for update to authenticated using (true) with check (true);

-- 1.5 PROD_KODE_COUNTER (internal, tanpa policy — hanya lewat trigger security definer)
create table public.prod_kode_counter (
  mesin machine_type not null,
  tanggal date not null,
  counter int not null default 0,
  primary key (mesin, tanggal)
);
alter table public.prod_kode_counter enable row level security;

-- 1.6 PROD_DANDORI_LOG
create table public.prod_dandori_log (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  waktu_awal timestamptz not null,
  waktu_akhir timestamptz not null,
  kategori text not null default 'DANDORI',
  stasiun text,
  part_dari text,
  part_ke text,
  keterangan text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_prod_dandori_log_mesin_waktu on public.prod_dandori_log (mesin, waktu_awal desc);
alter table public.prod_dandori_log enable row level security;
create policy "Login bisa lihat prod_dandori_log" on public.prod_dandori_log for select to authenticated using (true);
create policy "Login bisa tambah prod_dandori_log" on public.prod_dandori_log for insert to authenticated with check (true);
create policy "Login bisa update prod_dandori_log" on public.prod_dandori_log for update to authenticated using (true);
create policy "Login bisa hapus prod_dandori_log" on public.prod_dandori_log for delete to authenticated using (true);

-- 1.7 PROD_PRODUCTION_PLANNING
create table public.prod_production_planning (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  stasiun text,
  part_number text not null,
  qty_rencana integer,
  jam_rencana_mulai timestamptz not null,
  jam_rencana_selesai timestamptz not null,
  status text not null default 'pending' check (status in ('pending','selesai')),
  actual_production_id uuid references public.prod_production_log(id) on delete set null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_prod_production_planning_mesin_waktu on public.prod_production_planning (mesin, jam_rencana_mulai desc);
alter table public.prod_production_planning enable row level security;
create policy "Login bisa lihat prod_production_planning" on public.prod_production_planning for select to authenticated using (true);
create policy "Admin/Leader bisa tambah prod_production_planning" on public.prod_production_planning for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));
create policy "Admin/Leader bisa update prod_production_planning" on public.prod_production_planning for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));
create policy "Admin/Leader bisa hapus prod_production_planning" on public.prod_production_planning for delete to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));

-- 1.8 PROD_NONPRODUKSI_TYPES
create table public.prod_nonproduksi_types (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  nama text not null,
  created_at timestamptz not null default now(),
  unique (mesin, nama)
);
alter table public.prod_nonproduksi_types enable row level security;
create policy "Login bisa lihat prod_nonproduksi_types" on public.prod_nonproduksi_types for select to authenticated using (true);
create policy "Login bisa tambah prod_nonproduksi_types" on public.prod_nonproduksi_types for insert to authenticated with check (true);
create policy "Login bisa update prod_nonproduksi_types" on public.prod_nonproduksi_types for update to authenticated using (true);
create policy "Login bisa hapus prod_nonproduksi_types" on public.prod_nonproduksi_types for delete to authenticated using (true);

-- 1.9 PROD_MESIN_SETTINGS (target GSPH per mesin — satu baris per mesin)
create table public.prod_mesin_settings (
  mesin machine_type primary key,
  gsph_target_mode text not null default 'fixed' check (gsph_target_mode in ('fixed','per_part')),
  gsph_target_fixed numeric not null default 0,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.prod_mesin_settings enable row level security;
create policy "Login bisa lihat prod_mesin_settings" on public.prod_mesin_settings for select to authenticated using (true);
create policy "Admin/Leader bisa insert prod_mesin_settings" on public.prod_mesin_settings for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));
create policy "Admin/Leader bisa update prod_mesin_settings" on public.prod_mesin_settings for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));

-- 1.10 PROD_ATTENDANCE_LOG
create table public.prod_attendance_log (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  shift text not null check (shift in ('1','2')),
  total_orang integer not null default 0,
  hadir integer not null default 0,
  absen integer not null default 0,
  overtime_jam numeric not null default 0,
  cuti integer not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tanggal, shift)
);
alter table public.prod_attendance_log enable row level security;
create policy "Login bisa lihat prod_attendance_log" on public.prod_attendance_log for select to authenticated using (true);
create policy "Admin/Leader bisa insert prod_attendance_log" on public.prod_attendance_log for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));
create policy "Admin/Leader bisa update prod_attendance_log" on public.prod_attendance_log for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));

-- 1.11 PROD_SAFETY_LOG
create table public.prod_safety_log (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null,
  kategori text not null default 'ACCIDENT',
  keterangan text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.prod_safety_log enable row level security;
create policy "Login bisa lihat prod_safety_log" on public.prod_safety_log for select to authenticated using (true);
create policy "Admin/Leader kelola prod_safety_log" on public.prod_safety_log for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));

-- 1.12 PROD_SCRAP_TOP_END
create table public.prod_scrap_top_end (
  id uuid primary key default gen_random_uuid(),
  tahun integer not null,
  bulan integer not null check (bulan between 1 and 12),
  scrap_value_kidr numeric not null default 0,
  total_value_kidr numeric not null default 0,
  target_rasio numeric,
  created_at timestamptz not null default now(),
  unique (tahun, bulan)
);
alter table public.prod_scrap_top_end enable row level security;
create policy "Login bisa lihat prod_scrap_top_end" on public.prod_scrap_top_end for select to authenticated using (true);
create policy "Admin/Leader kelola prod_scrap_top_end" on public.prod_scrap_top_end for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));

-- =========================================================
-- 2. FUNGSI TRIGGER (internal, prefix prod_)
-- =========================================================

create or replace function public.prod_set_updated_meta()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql;

create or replace function public.prod_generate_kode_produksi()
returns trigger as $$
declare
  prefix text;
  hari date := (new.waktu_awal at time zone 'Asia/Jakarta')::date;
  next_counter int;
begin
  prefix := case new.mesin
    when 'tandem' then 'TDM'
    when 'blanking' then 'BLK'
    when 'transfer_2000t' then 'TR2'
    when 'transfer_800t' then 'TR8'
    when 'pc200t' then 'PC2'
    else 'MSN'
  end;

  insert into public.prod_kode_counter (mesin, tanggal, counter)
  values (new.mesin, hari, 1)
  on conflict (mesin, tanggal) do update set counter = public.prod_kode_counter.counter + 1
  returning counter into next_counter;

  new.kode := prefix || '-' || to_char(hari, 'YYMMDD') || '-' || lpad(next_counter::text, 3, '0');
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.prod_link_and_validate_downtime()
returns trigger as $$
declare
  match_id uuid;
  match_count int;
begin
  select id, count(*) over() into match_id, match_count
  from public.prod_production_log
  where mesin = new.mesin
    and (stasiun is not distinct from new.stasiun)
    and waktu_awal <= new.waktu_awal
    and waktu_akhir >= new.waktu_akhir
  limit 1;

  if match_count is null or match_count = 0 then
    raise exception 'Waktu downtime (% - %) tidak cocok dengan satu baris produksi mana pun di stasiun ini — kemungkinan melintasi 2 part. Sesuaikan jamnya supaya pas di dalam satu part.',
      new.waktu_awal, new.waktu_akhir;
  end if;

  new.production_log_id := match_id;
  return new;
end;
$$ language plpgsql;

create or replace function public.prod_sync_production_downtime_menit()
returns trigger as $$
begin
  if TG_OP in ('UPDATE','DELETE') and OLD.production_log_id is not null then
    update public.prod_production_log set downtime_menit = coalesce((
      select sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60)
      from public.prod_downtime_log where production_log_id = OLD.production_log_id
    ), 0) where id = OLD.production_log_id;
  end if;
  if TG_OP in ('INSERT','UPDATE') and NEW.production_log_id is not null then
    update public.prod_production_log set downtime_menit = coalesce((
      select sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60)
      from public.prod_downtime_log where production_log_id = NEW.production_log_id
    ), 0) where id = NEW.production_log_id;
  end if;
  return null;
end;
$$ language plpgsql;

-- =========================================================
-- 3. TRIGGER (prefix prod_trg_)
-- =========================================================

create trigger prod_trg_production_log_kode
  before insert on public.prod_production_log
  for each row execute procedure public.prod_generate_kode_produksi();

create trigger prod_trg_production_log_updated
  before update on public.prod_production_log
  for each row execute procedure public.prod_set_updated_meta();

create trigger prod_trg_downtime_log_updated
  before update on public.prod_downtime_log
  for each row execute procedure public.prod_set_updated_meta();

create trigger prod_trg_downtime_log_validate
  before insert or update on public.prod_downtime_log
  for each row execute procedure public.prod_link_and_validate_downtime();

create trigger prod_trg_sync_downtime_menit
  after insert or update or delete on public.prod_downtime_log
  for each row execute procedure public.prod_sync_production_downtime_menit();

create trigger prod_trg_dandori_log_updated
  before update on public.prod_dandori_log
  for each row execute procedure public.prod_set_updated_meta();

create trigger prod_trg_production_planning_updated
  before update on public.prod_production_planning
  for each row execute procedure public.prod_set_updated_meta();

create trigger prod_trg_attendance_log_updated
  before update on public.prod_attendance_log
  for each row execute procedure public.prod_set_updated_meta();

-- =========================================================
-- 4. FUNGSI RPC (dipanggil dari dashboard & machine pages, prefix prod_)
-- =========================================================

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
         where pl.id = pp.actual_production_id)
      else 0 end
    ), 0)
  from public.prod_production_planning pp
  where pp.mesin = p_mesin
    and pp.jam_rencana_mulai >= p_start and pp.jam_rencana_mulai < p_end;
$$;

create or replace function public.prod_achievement_summary(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
returns table(qty_rencana numeric, qty_aktual numeric, achievement_pct numeric)
language sql stable as $$
  with rencana as (
    select coalesce(sum(qty_rencana), 0) as total
    from public.prod_production_planning
    where mesin = p_mesin
      and (p_stasiun_list is null or stasiun = any(p_stasiun_list))
      and jam_rencana_mulai >= p_start and jam_rencana_mulai < p_end
  ),
  aktual as (
    select coalesce(sum(qty), 0) as total
    from public.prod_production_log
    where mesin = p_mesin
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
    and extract(dow from tanggal) not in (0, 6);
$$;

create or replace function public.prod_downtime_by_category(p_mesin machine_type, p_stasiun_list text[], p_start timestamptz, p_end timestamptz)
returns table(kategori text, total_menit numeric)
language sql stable as $$
  select kategori, sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60) as total_menit
  from public.prod_downtime_log
  where mesin = p_mesin
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
    where pl.waktu_awal >= p_start and pl.waktu_awal < p_end
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
      where tanggal >= p_start and tanggal < p_end and kategori = 'ACCIDENT'),
    (select coalesce(
      (current_date - max(tanggal))::integer,
      (current_date - date '2024-04-01')::integer
    ) from public.prod_safety_log where kategori = 'ACCIDENT');
$$;

create or replace function public.prod_scrap_top_end_summary(p_start date, p_end date)
returns table(scrap_value_kidr numeric, total_value_kidr numeric, rasio numeric, target_rasio numeric)
language sql stable as $$
  with f as (
    select * from public.prod_scrap_top_end
    where make_date(tahun, bulan, 1) >= date_trunc('month', p_start)::date
      and make_date(tahun, bulan, 1) < p_end
  )
  select
    coalesce(sum(scrap_value_kidr), 0),
    coalesce(sum(total_value_kidr), 0),
    case when coalesce(sum(total_value_kidr),0) > 0
      then sum(scrap_value_kidr) / sum(total_value_kidr) else 0 end,
    coalesce(avg(target_rasio), 0)
  from f;
$$;

-- =========================================================
-- SELESAI.
-- Semua fungsi RPC di atas dipanggil dari frontend project-experiment
-- dengan nama TANPA prefix (mis. supabase.rpc('gsph_hourly', ...)).
-- Ini WAJIB disesuaikan jadi supabase.rpc('prod_gsph_hourly', ...) dkk
-- pas porting kode di Fase 3/4 — dicatat di sini supaya tidak lupa.
-- =========================================================
