create table if not exists display_heartbeats (
  land_id uuid primary key references lands(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists display_heartbeats_last_seen_at_idx
on display_heartbeats (last_seen_at);
