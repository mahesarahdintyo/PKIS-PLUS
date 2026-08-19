-- =========================================================
-- MIGRASI: Skema Andon yang benar-benar aktif di production, ditulis ulang
-- idempotent (IF NOT EXISTS di semua tempat) supaya aman dijalankan ulang
-- tanpa menimpa data yang sudah ada.
--
-- Konteks: migration_andon_v1.sql mendefinisikan andon_calls dengan kolom
-- reason/called_by/called_by_name/resolved_by/status open-resolved, TAPI
-- database production ternyata sudah pakai skema vanilla asli (alasan/
-- triggered_by/acknowledged_by/acknowledged_at/escalated_at/status
-- pending-acknowledged-escalated) — dicek langsung lewat REST API
-- (PostgREST error messages) sebelum migrasi ini ditulis. Kode aplikasi
-- (hooks/useAndon.ts dkk) disesuaikan mengikuti skema live ini.
--
-- Tabel andon_leaders & push_subscriptions di bawah ternyata JUGA sudah
-- ada di production dengan kolom yang persis sama seperti vanilla —
-- migrasi ini cuma mendokumentasikan/memastikan (idempotent), bukan
-- membuat dari nol.
-- =========================================================

-- 1. Pastikan kolom andon_calls yang dipakai vanilla lengkap (no-op kalau
--    sudah ada — dikonfirmasi sudah ada semua di production).
alter table public.andon_calls add column if not exists alasan text;
alter table public.andon_calls add column if not exists triggered_by uuid references auth.users(id);
alter table public.andon_calls add column if not exists acknowledged_by uuid references auth.users(id);
alter table public.andon_calls add column if not exists acknowledged_at timestamptz;
alter table public.andon_calls add column if not exists escalated_at timestamptz;
alter table public.andon_calls add column if not exists stasiun text;

-- 2. andon_leaders — leader per mesin + tier (tier 1 = utama, tier 2 = eskalasi).
create table if not exists public.andon_leaders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mesin machine_type not null,
  tier smallint not null default 1 check (tier in (1, 2)),
  created_at timestamptz not null default now(),
  unique (user_id, mesin, tier)
);

alter table public.andon_leaders enable row level security;

drop policy if exists "Login bisa lihat andon_leaders" on public.andon_leaders;
create policy "Login bisa lihat andon_leaders"
  on public.andon_leaders for select to authenticated using (true);

drop policy if exists "User kelola pendaftaran leader sendiri" on public.andon_leaders;
create policy "User kelola pendaftaran leader sendiri"
  on public.andon_leaders for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "User hapus pendaftaran leader sendiri" on public.andon_leaders;
create policy "User hapus pendaftaran leader sendiri"
  on public.andon_leaders for delete to authenticated
  using (user_id = auth.uid());

-- 3. push_subscriptions — device (browser) yang didaftarkan menerima push.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  device_label text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "User kelola subscription push sendiri" on public.push_subscriptions;
create policy "User kelola subscription push sendiri"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =========================================================
-- SELESAI. Edge functions (andon-escalate, send-andon-push) & eskalasi
-- pg_cron perlu di-deploy & di-set secrets terpisah lewat Supabase CLI —
-- lihat supabase/functions/README di masing-masing folder function.
-- =========================================================
