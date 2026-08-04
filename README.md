# 🏭 Futaba PKIS — Production & Knowledge Information System

**Futaba PKIS** adalah sistem informasi produksi dan manajemen dokumen kerja digital yang dirancang khusus untuk lini produksi **PT FUTABA**. Sistem ini menggabungkan dua fungsi utama dalam satu platform terintegrasi:

1. **Manajemen Dokumen Kerja** — Admin mengelola SOP, manual, dan form kerja. Operator di tablet menampilkan dokumen ke layar TV Display secara realtime.
2. **Laporan Produksi Harian** — Operator mengisi laporan produksi (QTY, NG, Kategori NG) langsung dari tablet, dan Admin memantau serta menganalisis data tersebut di dashboard.

---

## ✨ Fitur Utama

### 👑 Admin
| Fitur | Keterangan |
|---|---|
| Workspace Dokumen | Kelola folder, unggah/hapus dokumen SOP/Manual/Form per lini (Land) |
| Laporan Produksi | Pantau laporan harian semua operator secara realtime — filter, search, export CSV |
| Detail Laporan | Lihat detail lengkap + salin laporan ke clipboard |
| Hapus Laporan | Hapus laporan dengan konfirmasi modal |
| Manajemen Part Number | Tambah & hapus part number yang langsung tersinkron ke dropdown operator |
| Manajemen Kategori NG | Tambah & hapus kategori cacat (NG) yang dipakai operator |
| **Status & Monitoring Sistem** | Pantau status online/offline setiap TV Display lini produksi dari halaman `/system` |

### 📱 Operator
| Fitur | Keterangan |
|---|---|
| Tampilkan Dokumen | Pilih & kirim dokumen ke TV Display secara realtime |
| Laporan Produksi | Isi QTY, NG, Kategori NG per sesi produksi; hasilnya langsung muncul di dashboard admin |
| Kategori NG Dinamis | Pilihan kategori NG muncul otomatis saat NG > 0, wajib dipilih |
| Validasi Form | QTY tidak boleh 0; Kategori NG wajib jika ada NG |

### 📺 TV Display
- Menampilkan dokumen aktif secara realtime (update < 1 detik)
- Tidak memerlukan interaksi fisik — cukup buka sekali di browser

### 📲 Progressive Web App (PWA)
- Dapat diinstal ke layar utama perangkat (Android, Tablet, iOS)
- Tombol **Install Aplikasi** muncul di form login saat browser mendukung
- Panduan instalasi untuk iOS Safari tampil otomatis di perangkat Apple
- Service Worker dengan strategi caching cerdas: network-only untuk Supabase & `/api/*`, network-first untuk navigasi halaman, cache-first untuk static assets
- Halaman **Offline fallback** saat koneksi terputus

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Framework** | Next.js 16 (React 19 + TypeScript) + Turbopack |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Storage** | Supabase Storage Bucket (`documents`) |
| **Realtime** | Supabase Realtime Channels |
| **Auth** | Supabase Auth (email/password) + RBAC middleware |
| **PWA** | Custom Service Worker (manual, tanpa plugin) + Web App Manifest |
| **Package Manager** | npm |

---

## 📦 Struktur Proyek

```
Futaba-Project/
├── app/
│   ├── admin/                  # Halaman Admin (workspace + laporan + manajemen)
│   ├── operator/               # Halaman Operator (tablet)
│   ├── display/[landId]/       # Halaman TV Display per lini
│   ├── system/                 # Halaman Status & Monitoring Sistem
│   ├── offline/                # Halaman fallback PWA saat tidak ada koneksi
│   └── api/                    # API Routes (Next.js Route Handlers)
│       ├── ng-categories/      # CRUD kategori NG
│       ├── part-numbers/       # CRUD part number
│       ├── production-reports/ # CRUD laporan produksi
│       ├── documents/          # CRUD dokumen
│       ├── folders/            # CRUD folder
│       ├── lands/              # CRUD lini produksi (land)
│       └── system/             # System health & display heartbeat API
├── components/
│   ├── admin/
│   │   ├── AdminLandCard.tsx               # Card Land admin
│   │   ├── CreateLandDialog.tsx            # Dialog buat Land admin
│   │   ├── ProductionReportsDashboard.tsx  # Dashboard laporan produksi admin
│   │   ├── AdminPartNumbersPanel.tsx       # Panel manajemen part number
│   │   └── AdminNgCategoriesPanel.tsx      # Panel manajemen kategori NG
│   ├── operator/
│   │   ├── OperatorHeader.tsx
│   │   ├── ProductionReportForm.tsx        # Form laporan produksi operator
│   │   └── DocumentList.tsx               # List berkas di operator
│   ├── ui/                                 # Komponen reusable / umum
│   │   ├── app-header.tsx                 # Header aplikasi dengan logo PKIS
│   │   ├── login-form.tsx                 # Form login + tombol install PWA
│   │   ├── logout-button.tsx
│   │   └── ...
│   └── pwa-register.tsx                   # Registrasi Service Worker & event PWA
├── public/
│   ├── manifest.json                      # Web App Manifest (PWA)
│   ├── service-worker.js                  # Custom Service Worker (PWA)
│   ├── icon-192.png                       # Ikon PWA 192×192
│   ├── icon-512.png                       # Ikon PWA 512×512
│   ├── icon-512-maskable.png              # Ikon PWA maskable 512×512
│   ├── icon.svg                           # Favicon PKIS (monogram "P" hijau)
│   ├── apple-icon.png                     # Apple Touch Icon
│   └── pkis-logo-wordmark(final).png      # Logo wordmark PKIS
├── lib/
│   └── services/               # Service layer (fetch helpers)
│       ├── production-report.ts
│       ├── part-number.ts
│       ├── ng-category.ts
│       └── ...
└── supabase/
    └── migrations/             # File SQL migrasi database
```

---

## 🚀 Panduan Setup Lokal

### Prasyarat
- **Node.js** v18+ (LTS recommended)
- **npm** v9+ (sudah termasuk dengan Node.js)
- **Akun Supabase** (free tier cukup)

### 1. Clone & Install

```bash
git clone https://github.com/mahesarahdintyo/Futaba-Project.git
cd Futaba-Project
npm install
```

### 2. Environment Variables

Buat file `.env.local` di root proyek:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 3. Setup Database Supabase

Jalankan semua file SQL di folder `supabase/migrations/` secara berurutan via **Supabase SQL Editor**:

| File | Keterangan |
|---|---|
| `20260708_create_production_reports.sql` | Tabel laporan produksi + RLS |
| `20260710_create_part_numbers.sql` | Tabel part number + RLS |
| `ng_categories.sql` | Tabel kategori NG + RLS |
| *(migrations lainnya)* | Lihat folder `supabase/migrations/` |

Untuk tabel dasar (`lands`, `folders`, `documents`, dll.) lihat [docs/INSTALLATION.md](./docs/INSTALLATION.md).

### 4. Setup Storage Bucket

Di dashboard Supabase → **Storage** → buat bucket bernama `documents` → set **Public**.

### 5. Jalankan Aplikasi

```bash
npm run dev        # Development mode
# atau
npm run build && npm run start   # Production mode
```

Buka **[http://localhost:3000](http://localhost:3000)**.

---

## 🧭 Alur Penggunaan

```
Admin Login (halaman utama)
  └─ Ke Dashboard Admin (/admin)
  │    └─ Tab: Workspace       → Kelola dokumen/folder per lini
  │    └─ Tab: Laporan Produksi→ Pantau laporan operator secara realtime
  │    └─ Tab: Part Number     → Tambah/hapus part number
  │    └─ Tab: Kategori NG     → Tambah/hapus kategori cacat
  └─ Akses Sebagai Operator (/operator)
  └─ Status & Monitoring Sistem (/system)

Operator (tablet)
  └─ Pilih Part Number
  └─ Sistem otomatis set waktu mulai
  └─ Tekan Finish → sistem set waktu selesai
  └─ Isi QTY (wajib, > 0)
  └─ Isi NG (jika ada → pilih Kategori NG)
  └─ Simpan Laporan → dashboard admin otomatis update tanpa refresh

TV Display
  └─ Buka /display/[landId] di browser TV
  └─ Operator kirim dokumen → tampil otomatis realtime

PWA Install
  └─ Buka halaman login
  └─ Klik tombol "Install Aplikasi Futaba PKIS" (jika muncul)
  └─ iOS: tekan Share → Add to Home Screen
```

---

## 📖 Dokumentasi Lengkap

| File | Keterangan |
|---|---|
| [docs/INSTALLATION.md](./docs/INSTALLATION.md) | Setup database lengkap & storage bucket |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | Panduan Admin, Operator, TV Display & PWA |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Referensi semua API endpoint |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Panduan deploy ke Vercel & konfigurasi RLS produksi |

---

## 🗄️ Skema Database (Ringkasan)

| Tabel | Keterangan |
|---|---|
| `lands` | Lini produksi (500T, 800T, dsb.) |
| `folders` | Folder hierarkis per lini |
| `documents` | Dokumen kerja (SOP, Manual, Form) |
| `categories` | Kategori dokumen |
| `land_display_documents` | Dokumen aktif yang sedang ditampilkan TV Display |
| `production_reports` | Laporan produksi harian operator |
| `part_numbers` | Daftar part number yang dapat dipilih |
| `ng_categories` | Kategori cacat (NG) yang dapat dipilih operator |
| `profiles` | Profil user + role (admin/operator) |

---

## 🔐 Autentikasi & Akses

Sistem menggunakan **Supabase Auth** dengan RBAC berbasis role:

| Role | Akses |
|---|---|
| `admin` | Semua halaman — workspace, laporan, manajemen part number & kategori NG, **monitoring sistem** |
| `operator` | Halaman operator (tampilkan dokumen + isi laporan produksi) |
| *(tanpa login)* | TV Display (`/display/[landId]`) — read-only |

---

## 📲 PWA — Progressive Web App

Aplikasi ini mendukung instalasi sebagai PWA di semua perangkat modern.

### Cara Install
- **Android / Chrome / Edge / Tablet**: Tombol **"Install Aplikasi Futaba PKIS"** akan muncul di form login. Klik untuk memulai instalasi.
- **iOS / iPad Safari**: Tombol yang sama akan muncul dengan instruksi: tekan **Share ⎋** → pilih **"Add to Home Screen"**.

### Strategi Caching (Service Worker)
| Jenis Request | Strategi |
|---|---|
| Supabase (`supabase.co`) & `/api/*` | **Network-Only** — data realtime selalu fresh |
| Navigasi halaman (HTML) | **Network-First** — fallback ke `/offline` jika tidak ada koneksi |
| Static assets (`/_next/static/`, gambar, ikon) | **Cache-First** — cepat dari cache |

---

## 📝 Lisensi

© 2026 PT FUTABA. Internal use only — all rights reserved.
