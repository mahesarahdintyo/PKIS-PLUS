-- Aktifkan extension yang dibutuhkan (aman dijalankan berkali-kali)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Simpan URL project & service role key di Supabase Vault (JANGAN hardcode di SQL biasa)
-- Ganti <PROJECT_REF> dan jalankan ini SEKALI lewat Supabase SQL Editor (bukan lewat migration file,
-- supaya service role key tidak ikut ter-commit ke git):
--
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'andon_escalate_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'andon_escalate_key');
--
-- Setelah 2 secret di atas dibuat manual, migration ini aman di-commit ke git:

select cron.schedule(
  'andon-escalate-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'andon_escalate_url') || '/functions/v1/andon-escalate',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'andon_escalate_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
