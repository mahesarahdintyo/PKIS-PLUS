-- ==============================================================================
-- MIGRATION: Fix documents storage bucket RLS policies
-- Adds "to authenticated" role restriction on insert/update/delete
-- ==============================================================================
-- ⚠️ MUST BE EXECUTED MANUALLY in Supabase Dashboard > SQL Editor
-- This file alone does NOT apply the changes to the Supabase cloud database.

-- Drop existing policies (from 20260831_create_documents_bucket.sql)
drop policy if exists "Public Access documents bucket" on storage.objects;
drop policy if exists "Authenticated insert documents bucket" on storage.objects;
drop policy if exists "Authenticated update documents bucket" on storage.objects;
drop policy if exists "Authenticated delete documents bucket" on storage.objects;

-- SELECT: still public (needed for shared document links / display TV)
create policy "Public Access documents bucket" on storage.objects
  for select using (bucket_id = 'documents');

-- INSERT: authenticated users only
create policy "Authenticated insert documents bucket" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

-- UPDATE: authenticated users only
create policy "Authenticated update documents bucket" on storage.objects
  for update to authenticated using (bucket_id = 'documents');

-- DELETE: authenticated users only
create policy "Authenticated delete documents bucket" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');
