# 📥 Panduan Instalasi Lokal (PKIS-PLUS)

Dokumen ini menjelaskan langkah-langkah untuk menyiapkan dan menjalankan **Futaba PKIS** di lingkungan pengembangan lokal menggunakan **PostgreSQL lokal**, **Prisma ORM**, dan server realtime **Socket.io**.

---

## 📋 Prasyarat Sistem

| Software | Versi Minimum | Keterangan |
|---|---|---|
| **Node.js** | v18+ (LTS direkomendasikan) | Runtime JavaScript |
| **npm** | v9+ | Paket manager bawaan Node.js |
| **PostgreSQL** | v14+ | Database lokal (via Laragon, Docker, atau installer native) |

---

## 🚀 Langkah Instalasi & Setup

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/mahesarahdintyo/PKIS-PLUS.git
cd PKIS-PLUS
npm install
```

---

### 2. Konfigurasi Environment Variables

Salin berkas template `.env.example` menjadi `.env` di root proyek:

```bash
cp .env.example .env
```
*(Atau `copy .env.example .env` di Windows Command Prompt / PowerShell)*

Buka file `.env` dan sesuaikan nilainya:

```env
# 1. Koneksi Database PostgreSQL
# Format: postgresql://<user>:<password>@<host>:<port>/<nama_db>?schema=public
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pkis_plus?schema=public"

# 2. Keamanan & Password Hashing
PASSWORD_SALT="pkis-production-secret-salt-2026-secure"

# 3. Server & Port
PORT=3000
HOST="0.0.0.0"

# 4. Storage & Direktori Upload
UPLOAD_DIR="./public/uploads"
NEXT_PUBLIC_STORAGE_URL="/uploads"

# 5. Polling Fallback
NEXT_PUBLIC_ENABLE_AUTO_POLLING=true

# 6. Web Push Notification (Opsional untuk modul Andon)
VAPID_PUBLIC_KEY="BCPEeRkRPz2P0UQKWiu1X3nAjZ5C3UrVG4In4KJXw8Z9TGJhHlRxCzxbqPekSEU7M_nOsoitqZr9Ry7Q0bFeNAw"
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:andon@localhost"

# 7. Akun Admin Default (untuk seeder)
DEFAULT_ADMIN_EMAIL="admin@pabrik.local"
DEFAULT_ADMIN_PASSWORD="admin123"
```

> **Catatan Database:** Pastikan database dengan nama `pkis_plus` sudah dibuat di PostgreSQL Anda sebelum menjalankan migrasi/push schema.  
> Contoh pembuatan via psql / pgAdmin / Laragon PostgreSQL:
> ```sql
> CREATE DATABASE pkis_plus;
> ```

---

### 3. Sinkronisasi Database dengan Prisma

Jalankan perintah berikut untuk menghasilkan Prisma Client dan menerapkan struktur tabel ke database lokal:

```bash
# Generate Prisma Client TypeScript types
npm run db:generate

# Terapkan skema Prisma langsung ke database lokal
npm run db:push
```

Jika ingin menggunakan alur migration historis untuk production development:
```bash
npm run db:migrate
```

---

### 4. Jalankan Database Seeder (Data Awal)

Isi database dengan akun awal (Admin, Operator, Leader) dan kategori dokumen default:

```bash
npm run db:seed
```

Hasil pembuatan akun default:
| Akun | Email / Username | Password | Role |
|---|---|---|---|
| **Admin** | `admin@pabrik.local` atau `admin` | `admin123` | `admin` |
| **Operator** | `operator@pabrik.local` atau `operator` | `operator123` | `operator` |
| **Leader** | `leader@pabrik.local` atau `leader` | `leader123` | `leader` |

Kategori dokumen default yang langsung tersedia:
- *Instruksi Kerja (IK)*
- *Standard Operating Procedure (SOP)*
- *Drawing / Gambar Kerja*
- *Form Pemeriksaan / Checksheet*
- *Dokumen Kualitas & Safety*

---

### 5. GUI Database Viewer (Prisma Studio) — Opsional

Untuk memeriksa atau mengelola isi tabel secara visual via browser:

```bash
npm run db:studio
```
Prisma Studio akan terbuka di `http://localhost:5555`.

---

### 6. Menjalankan Aplikasi

Aplikasi PKIS-PLUS menggunakan custom server `server.js` yang menyatukan **Next.js** dan WebSocket **Socket.io**.

#### Mode Development:
```bash
npm run dev
```

#### Mode Production:
```bash
npm run build
npm run start
```

Buka peramban di: **[http://localhost:3000](http://localhost:3000)**

---

## 📁 Struktur Direktori Berkas Upload

File dokumen yang diunggah oleh admin (PDF, JPG, PNG) otomatis tersimpan di folder lokal:
```
public/uploads/
└── documents/
```
Folder ini akan dibuat otomatis oleh server saat ada proses upload pertama kali jika belum ada.

---

## 🛠️ Pemecahan Masalah (Troubleshooting)

1. **Error: `Can't reach database server at localhost:5432`**
   - Pastikan service PostgreSQL sudah berjalan (misal: aktifkan PostgreSQL di Laragon atau Docker container).
   - Periksa kecocokan username, password, dan port pada `DATABASE_URL` di file `.env`.

2. **Error: `Prisma Client did not initialize yet`**
   - Jalankan `npm run db:generate` untuk merefresh engine client Prisma.

3. **Port 3000 bentrok / sudah terpakai**
   - Ubah variabel `PORT=3001` pada file `.env` dan restart server.

4. **Koneksi Realtime Socket.io tidak menyambung**
   - Pastikan Anda menjalankan aplikasi via `npm run dev` atau `node server.js` (bukan langsung `next dev`), agar Socket.io server terinisialisasi dengan benar pada path `/api/socket`.
