-- ==============================================================================
-- MIGRATION: Fix sync downtime_menit to exclude soft-deleted records (is_active = false)
-- When a downtime record is soft-deleted (moved to recycle bin) or restored,
-- prod_production_log.downtime_menit must accurately reflect only active downtime rows.
-- ==============================================================================

create or replace function public.prod_sync_production_downtime_menit()
returns trigger as $$
begin
  if TG_OP in ('UPDATE','DELETE') and OLD.production_log_id is not null then
    update public.prod_production_log set downtime_menit = coalesce((
      select sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60)
      from public.prod_downtime_log
      where production_log_id = OLD.production_log_id
        and is_active = true
    ), 0) where id = OLD.production_log_id;
  end if;
  if TG_OP in ('INSERT','UPDATE') and NEW.production_log_id is not null then
    update public.prod_production_log set downtime_menit = coalesce((
      select sum(extract(epoch from (waktu_akhir - waktu_awal)) / 60)
      from public.prod_downtime_log
      where production_log_id = NEW.production_log_id
        and is_active = true
    ), 0) where id = NEW.production_log_id;
  end if;
  return null;
end;
$$ language plpgsql;

-- One-time backfill: recalculate downtime_menit for all production logs to fix any stale values
update public.prod_production_log pl
set downtime_menit = coalesce((
  select sum(extract(epoch from (dl.waktu_akhir - dl.waktu_awal)) / 60)
  from public.prod_downtime_log dl
  where dl.production_log_id = pl.id
    and dl.is_active = true
), 0);
