# Stamping Production & Downtime System (Next.js 16)

Aplikasi web berbasis **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, dan **Supabase** untuk mencatat & memonitor data produksi, downtime mesin stamping, absensi manpower, dan indikator SQCDMP secara real-time.

---

## 🚀 Fitur Utama

- **Dashboard Real-time SQCDMP**: Memonitor GSPH, NG Rate, Productivity, Availability, Downtime, dan Morale (Attendance).
- **Dynamic Routing Mesin**: Mendukung halaman detail monitoring untuk 5 jenis mesin:
  - `/machines/blanking`
  - `/machines/pc200t`
  - `/machines/tandem`
  - `/machines/transfer-2000t`
  - `/machines/transfer-800t`
- **Modul Downtime & Jam Non-Produksi**: Pencatatan stop line, penyebab masalah, serta durasi kegiatan non-produksi (watari, 5S, meeting).
- **Input Attendance, Safety, Scrap**: Halaman input manpower harian (`/input-attendance`), insiden safety (`/input-safety`), dan scrap top end bulanan (`/input-scrap`), khusus role admin/leader.
- **Input Earned Hours (Productivity)**: Halaman `/input-productivity` untuk mencatat EH & WH harian per shift, digunakan menghitung P-Eff dan indikator Productivity vs. kijun.
- **Visualisasi Internal**: Mode tampilan khusus supervisor/internal pada dashboard utama, menampilkan grafik trend produktivitas, availability per line, GSPH per line, downtime per kategori, serta tabel *Worst-5 Downtime* per mesin (Kategori / Problem / Menit).
- **PWA & Mode Offline**: Aplikasi bisa di-*install* ke homescreen (`public/manifest.json`) dan tetap bisa dipakai saat sinyal lapangan lemah — service worker (`public/service-worker.js`) meng-cache shell halaman, dan input produksi/downtime/non-produksi/attendance/safety/scrap yang gagal tersimpan karena offline otomatis masuk antrean lokal (`lib/offlineQueue.ts`) lalu disinkron ulang otomatis begitu koneksi kembali (indikator status online/offline & tombol "Sync Now" ada di sidebar).
- **Supabase Authentication & Role-based Access**: Login aman untuk Operator, Leader, dan Admin.
- **Responsive Industrial UI**: Dilengkapi tema terang/gelap (*Light/Dark mode*) dan layout responsif untuk desktop & mobile.

---

## 🛠️ Memulai Aplikasi (Development)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Jalankan Server Development**:
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

3. **Build untuk Produksi**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🗄️ Database & Migrasi SQL

Seluruh script migrasi dan skema tabel Supabase tersimpan di folder `supabase/migrations/`:
- `schema.sql`: Skema utama tabel database.
- `seed.sql`: Data awal master part & problem catalog.
- `migration_*.sql`: Script migrasi tambahan untuk fitur absensi, SQCDMP, dan agregasi kinerja.
