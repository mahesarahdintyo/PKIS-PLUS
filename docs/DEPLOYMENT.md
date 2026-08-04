# 🚀 Panduan Deployment Produksi

Dokumen ini memandu proses deployment **Futaba PKIS** ke lingkungan produksi menggunakan **Vercel** sebagai hosting platform dan **Supabase** sebagai backend.

---

## ☁️ Deployment ke Vercel

### Langkah 1: Hubungkan Repository ke Vercel

1. Login ke [vercel.com](https://vercel.com).
2. Klik **Add New Project**.
3. Hubungkan repositori GitHub: `mahesarahdintyo/Futaba-Project`.
4. Pilih branch yang akan di-deploy (contoh: `main`).

### Langkah 2: Konfigurasi Environment Variables

Di halaman konfigurasi Vercel, buka bagian **Environment Variables** dan tambahkan:

| Variable | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase produksi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase produksi |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase produksi |

### Langkah 3: Deploy

Klik **Deploy**. Vercel akan otomatis mendeteksi Next.js dan menjalankan `next build`. Proses selesai dalam beberapa menit dan menghasilkan URL produksi HTTPS.

### Auto-Deploy

Setelah project terhubung, setiap **push ke branch `main`** akan otomatis memicu deployment baru di Vercel.

---

## 🗄️ Setup Database Produksi

Pastikan semua migrasi telah dijalankan di project Supabase **produksi** (bukan development). Urutan menjalankan migrasi:

1. Buat tabel dasar: `lands`, `folders`, `categories`, `documents`, `land_display_documents`
2. Jalankan semua file di `supabase/migrations/` berurutan sesuai tanggal

Lihat [INSTALLATION.md](./INSTALLATION.md) untuk detail query SQL setiap tabel.

---

## Realtime Supabase

Pastikan publication `supabase_realtime` di project Supabase produksi mengaktifkan tabel berikut:

- `production_reports`, agar laporan yang disubmit operator langsung muncul di dashboard admin.
- `part_numbers`, agar dropdown part number operator langsung mengikuti perubahan dari admin.

Konfigurasi dapat dilakukan dari **Supabase Dashboard -> Database -> Replication**, atau dengan SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.part_numbers;
```

Kode aplikasi juga memiliki fallback polling beberapa detik, tetapi Realtime tetap direkomendasikan untuk update paling cepat.

---
## 🔒 Keamanan Produksi (RLS)

Semua tabel sudah dikonfigurasi dengan **Row Level Security (RLS)**. Berikut rekomendasi kebijakan untuk produksi:

### Tabel dokumen & folder (write = authenticated only)

```sql
-- Perketat: hanya admin yang bisa insert/update/delete dokumen
DROP POLICY IF EXISTS "Allow public write documents" ON public.documents;
CREATE POLICY "Allow admin write documents"
  ON public.documents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Berlaku sama untuk tabel folders dan lands
```

### Tabel laporan produksi (insert = semua, delete = authenticated)

Laporan produksi perlu bisa diisi operator tanpa login khusus, sehingga INSERT tetap `public`. Namun DELETE dibatasi:

```sql
-- INSERT tetap public (operator bisa submit laporan)
-- DELETE hanya admin yang login
DROP POLICY IF EXISTS "Allow public delete production_reports" ON public.production_reports;
CREATE POLICY "Allow authenticated delete production_reports"
  ON public.production_reports FOR DELETE
  TO authenticated
  USING (true);
```

### Storage Bucket `documents`

Di **Supabase → Storage → Policies** pada bucket `documents`:
- **SELECT (Read)**: Allow untuk semua (`public`)
- **INSERT (Upload)**: Batasi ke `authenticated` saja
- **DELETE**: Batasi ke `authenticated` saja

---

## 🛠️ Pemeliharaan & Update

### Update Kode Aplikasi

```bash
# Di mesin lokal — push ke GitHub
git add .
git commit -m "feat: ..."
git push origin main
# Vercel otomatis re-deploy
```

### Update Database (Migrasi)

Jika ada perubahan skema database:
1. Buat file SQL baru di `supabase/migrations/` dengan format nama `YYYYMMDD_nama_migrasi.sql`.
2. Jalankan file SQL tersebut di **SQL Editor Supabase produksi** sebelum atau bersamaan dengan deploy kode baru.

### Monitoring

- **Vercel Dashboard**: Pantau deployment, logs, dan error runtime.
- **Supabase Dashboard**: Pantau query, storage usage, dan koneksi database.
- **Halaman System Status** (`/system`): Monitor status online/offline TV Display setiap lini.

---

## 📋 Checklist Sebelum Go-Live

- [ ] Semua environment variables sudah dikonfigurasi di Vercel
- [ ] Semua tabel sudah dibuat di Supabase produksi
- [ ] RLS policies sudah diperketat untuk lingkungan produksi
- [ ] Storage bucket `documents` sudah dibuat dan dikonfigurasi
- [ ] User admin sudah dibuat dan role `admin` sudah di-set di tabel `profiles`
- [ ] Part number awal sudah ditambahkan
- [ ] Kategori NG awal sudah ditambahkan
- [ ] TV Display di setiap lini sudah dicek koneksinya
- [ ] Build berhasil (`npm run build`) tanpa error
- [ ] PWA: `public/manifest.json` tersedia dan dapat diakses di URL produksi
- [ ] PWA: `public/service-worker.js` berjalan dengan benar di HTTPS
- [ ] PWA: Ikon `icon-192.png`, `icon-512.png`, dan `icon-512-maskable.png` sudah ada di `public/`
