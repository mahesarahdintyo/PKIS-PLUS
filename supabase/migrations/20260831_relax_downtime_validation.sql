-- ==============================================================================
-- MIGRATION: Relax Downtime Validation & Add Backfill Trigger
-- ==============================================================================

-- 1. Relax downtime validation trigger function so it links production_log_id without raising exception
create or replace function public.prod_link_and_validate_downtime()
returns trigger as $$
declare
  match_id uuid;
begin
  select id into match_id
  from public.prod_production_log
  where (
    (new.line_id is not null and line_id = new.line_id)
    or (new.line_id is null and mesin = new.mesin)
  )
    and (stasiun is not distinct from new.stasiun)
    and waktu_awal <= new.waktu_awal
    and waktu_akhir >= new.waktu_akhir
    and is_active = true
  order by waktu_awal desc
  limit 1;

  new.production_log_id := match_id;
  return new;
end;
$$ language plpgsql;

-- 2. Backfill trigger on prod_production_log to automatically link any downtime falling inside its timeframe
create or replace function public.prod_backfill_downtime_links()
returns trigger as $$
begin
  update public.prod_downtime_log
  set production_log_id = new.id
  where (
    (new.line_id is not null and line_id = new.line_id)
    or (new.line_id is null and mesin = new.mesin)
  )
    and (stasiun is not distinct from new.stasiun)
    and waktu_awal >= new.waktu_awal
    and waktu_akhir <= new.waktu_akhir
    and is_active = true
    and (production_log_id is null or production_log_id != new.id);

  return new;
end;
$$ language plpgsql;

drop trigger if exists prod_trg_backfill_downtime on public.prod_production_log;
create trigger prod_trg_backfill_downtime
  after insert or update on public.prod_production_log
  for each row execute procedure public.prod_backfill_downtime_links();
