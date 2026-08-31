-- ==============================================================================
-- MIGRATION: Setup documents storage bucket and RLS policies
-- ==============================================================================

-- 1. Create bucket documents if not exists
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do update set public = true;

-- 2. Storage Policies for bucket documents
drop policy if exists "Public Access documents bucket" on storage.objects;
create policy "Public Access documents bucket" on storage.objects
  for select using (bucket_id = 'documents');

drop policy if exists "Authenticated insert documents bucket" on storage.objects;
create policy "Authenticated insert documents bucket" on storage.objects
  for insert with check (bucket_id = 'documents');

drop policy if exists "Authenticated update documents bucket" on storage.objects;
create policy "Authenticated update documents bucket" on storage.objects
  for update using (bucket_id = 'documents');

drop policy if exists "Authenticated delete documents bucket" on storage.objects;
create policy "Authenticated delete documents bucket" on storage.objects
  for delete using (bucket_id = 'documents');
