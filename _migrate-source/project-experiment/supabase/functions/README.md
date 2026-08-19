# Andon edge functions — deploy manual

Dua function ini (Deno, bukan Next.js) tidak ikut ke-deploy otomatis lewat
`npm run build` / hosting Next.js. Deploy & konfigurasi terpisah lewat
Supabase CLI:

```bash
supabase functions deploy send-andon-push
supabase functions deploy andon-escalate

supabase secrets set VAPID_PUBLIC_KEY=<isi ANDON_VAPID_PUBLIC_KEY di hooks/useAndon.ts>
supabase secrets set VAPID_PRIVATE_KEY=<private key pasangannya>
```

`SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` sudah otomatis tersedia di
tiap edge function, tidak perlu di-set manual.

Untuk eskalasi otomatis ke leader tier 2 (5 menit tanpa respon), jadwalkan
`andon-escalate` tiap 1 menit lewat Supabase Dashboard → Database → Cron
Jobs (atau `pg_cron` + `pg_net`), memanggil:
`POST {SUPABASE_URL}/functions/v1/andon-escalate` dengan header
`Authorization: Bearer <service_role_key>`.

Tanpa langkah-langkah manual di atas, panggilan Andon tetap tercatat dan
overlay realtime in-app (saat app terbuka) tetap jalan — yang tidak
berfungsi hanya push notification saat app tertutup + eskalasi otomatis.
