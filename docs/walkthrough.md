# Walkthrough: Modernisasi & Migrasi Sistem PKIS-PLUS

Dokumen ini mencatat riwayat pembaruan arsitektur besar yang telah selesai diterapkan pada sistem **PKIS-PLUS**.

---

## 🎯 Tahap 1: Refactoring Total "Land" -> "Line" (Selesai)

Penyelarasan nomenklatur dari istilah lama "*land*" menjadi "*line*" (lini produksi):

1. **Database**: Mengganti tabel `lands` menjadi `lines` dan foreign key `land_id` menjadi `line_id` pada seluruh entitas terkait.
2. **Services & Helpers**: Memperbarui pustaka layanan internal (`lib/services/line.ts`, `workspace-server.ts`, dll.).
3. **Komponen UI**: Pembaruan komponen dari `AdminLandCard` -> `AdminLineCard`, `CreateLandDialog` -> `CreateLineDialog`, `LandSelector` -> `LineSelector`.
4. **Rute & Halaman**: Migrasi rute display menjadi `/display/[lineId]` dan API endpoint `/api/lines`.

---

## 🚀 Tahap 2: Migrasi Arsitektur Mandiri (Self-Hosted Architecture) (Selesai)

Transformasi total dari dependensi cloud eksternal (*Supabase Cloud*) ke arsitektur lokal on-premise yang mandiri, andal, dan berkecepatan tinggi:

### 1. Database & ORM (PostgreSQL + Prisma)
- Skema database didefinisikan secara deklaratif di [`prisma/schema.prisma`](file:///c:/laragon/www/PKIS-PLUS/prisma/schema.prisma).
- Seluruh query aplikasi bermigrasi ke `PrismaClient` melalui [`lib/prisma.ts`](file:///c:/laragon/www/PKIS-PLUS/lib/prisma.ts).
- Penambahan skrip migrasi dan seeder otomatis di [`prisma/seed.js`](file:///c:/laragon/www/PKIS-PLUS/prisma/seed.js) untuk inisialisasi akun Admin, Operator, Leader, dan kategori dokumen default.

### 2. Realtime WebSocket (Socket.io Engine)
- Menggantikan Supabase Realtime Channels dengan custom server [`server.js`](file:///c:/laragon/www/PKIS-PLUS/server.js) yang menggabungkan Next.js dan **Socket.io**.
- Socket.io mendengarkan pada path `/api/socket` dengan dukungan room berbasis lini (`line:[lineId]`) dan mesin (`mesin:[mesinId]`).
- Event instan (< 1 detik) untuk TV Display sync, andon call broadcast, dan live production logs.

### 3. File Storage Lokal & Uploads
- Menggantikan Supabase Storage Bucket dengan penyimpanan disk lokal server di direktori `public/uploads/documents/`.
- Endpoint upload (`/api/upload`) dan pengunduhan aman (`/api/download`) menangani validasi tipe MIME, ukuran file (maks. 50MB), dan integrasi recycle bin.

### 4. Autentikasi Mandiri (Session Cookie + HMAC-SHA256)
- Sistem autentikasi mandiri berbasis session token di database (`users` & `sessions` table) melalui [`lib/auth.ts`](file:///c:/laragon/www/PKIS-PLUS/lib/auth.ts).
- Menggunakan cookie HTTP-only yang aman tanpa ketergantungan pada auth provider pihak ketiga.

---

## 🛠️ Hasil Verifikasi Teknis

- **Kompilasi TypeScript**: `npx tsc --noEmit` → **PASS (0 Errors)**
- **Production Build**: `npm run build` → **PASS (Exit code 0, 18+ routes compiled)**
- **Runtime Server**: `node server.js` / `npm run dev` → **Ready at Port 3000**
