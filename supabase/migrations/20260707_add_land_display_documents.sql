create table if not exists display_documents (
  land_key text primary key,
  land_id uuid references lands(id) on delete cascade,
  document jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists display_documents_land_id_idx
on display_documents (land_id);
