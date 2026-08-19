-- =========================================================
-- MIGRASI: Sistem Andon (panggil leader) + Target Availability
-- Jalankan sekali di Supabase SQL Editor
--
-- CATATAN (superseded): kolom andon_calls di bawah ini (reason,
-- called_by, called_by_name, resolved_by, status open/resolved) TIDAK
-- SESUAI dengan skema yang benar-benar live di database production —
-- skema live pakai alasan/triggered_by/acknowledged_by/acknowledged_at/
-- escalated_at/status pending-acknowledged-escalated (skema vanilla asli).
-- Kode aplikasi sekarang mengikuti skema live tsb, bukan file ini.
-- Lihat migration_andon_v2_leaders_push.sql untuk skema yang aktif.
-- =========================================================

-- 1. Tabel panggilan Andon
create table if not exists public.andon_calls (
  id uuid primary key default gen_random_uuid(),
  mesin machine_type not null,
  stasiun text,
  reason text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  called_by uuid references auth.users(id),
  called_by_name text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_andon_calls_open on public.andon_calls (mesin, status, created_at desc);

alter table public.andon_calls enable row level security;

drop policy if exists "Login bisa lihat andon_calls" on public.andon_calls;
create policy "Login bisa lihat andon_calls"
  on public.andon_calls for select to authenticated using (true);

drop policy if exists "Login bisa buat andon_calls" on public.andon_calls;
create policy "Login bisa buat andon_calls"
  on public.andon_calls for insert to authenticated with check (true);

drop policy if exists "Admin/Leader bisa update andon_calls" on public.andon_calls;
create policy "Admin/Leader bisa update andon_calls"
  on public.andon_calls for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','leader')));

-- Aktifkan realtime untuk tabel ini (supaya overlay leader bisa subscribe)
alter publication supabase_realtime add table public.andon_calls;

-- 2. Target Availability (%) per mesin, di tabel mesin_settings yang sudah ada
alter table public.mesin_settings
  add column if not exists target_availability numeric not null default 0;

-- =========================================================
-- SELESAI.
-- =========================================================
