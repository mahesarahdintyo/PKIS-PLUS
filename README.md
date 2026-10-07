# 🏭 Futaba PKIS — Production & Knowledge Information System (PKIS-PLUS)

**Futaba PKIS (PKIS-PLUS)** adalah sistem informasi produksi terpadu dan manajemen dokumen kerja digital yang dirancang khusus untuk operasional lini produksi di lingkungan pabrik **PT FUTABA**.

Sistem ini menggabungkan manajemen dokumen digital, pencatatan produksi dan downtime secara realtime, sistem bantuan operator (Andon Call), serta pemantauan status lini secara terpusat tanpa ketergantungan pada layanan cloud eksternal.

---

## ✨ Fitur Utama

### 👑 Administrator
| Fitur | Keterangan |
|---|---|
| **Workspace Dokumen** | Kelola folder hierarkis, unggah berkas SOP/Drawing/IK per lini kerja (Line), edit inline nama/judul, dan sembunyikan dokumen draft. |
| **Laporan Produksi Realtime** | Pantau laporan harian operator secara realtime tanpa refresh halaman — filter lini, tanggal, shift, pencarian, dan export CSV. |
| **Manajemen Part Number** | Kelola master part number per mesin yang langsung tersinkron ke tablet operator via WebSocket. |
| **Manajemen Kategori NG** | Kelola kategori cacat produk (NG) yang dapat dipilih oleh operator. |
| **Tempat Sampah (Recycle Bin)** | Pulihkan (*restore*) atau bersihkan permanen (*purge*) dokumen dan folder yang terhapus sementara. |
| **Monitoring Sistem (`/system`)** | Pantau status online/offline TV Display setiap lini produksi, kesehatan database, dan direktori penyimpanan file. |

### 🚨 Pengawas / Leader
| Fitur | Keterangan |
|---|---|
| **Andon Monitor** | Menerima panggilan darurat (*Andon Call*) dari operator lini saat terjadi kendala mesin, dies, atau material. |
| **Web Push Notification** | Mendukung notifikasi push langsung ke browser ponsel/tablet pengawas saat operator memicu panggilan Andon. |

### 📱 Operator (Tablet Lini)
| Fitur | Keterangan |
|---|---|
| **Tayangkan Dokumen ke TV** | Pilih dokumen SOP / Drawing dan kirimkan langsung ke layar TV Display secara instan (< 1 detik). |
| **Pencatatan Produksi Harian** | Input QTY OK, jumlah NG, kategori cacat dinamis, waktu mulai/selesai sesi, dan menit istirahat (*break*). |
| **Pencatatan Downtime** | Catat waktu henti lini beserta kategori masalah, penyebab, dan tindakan penanganan (*countermeasure*). |
| **Panggilan Andon** | Panggil Leader/Maintenance dalam satu sentuhan tombol ketika lini mengalami hambatan. |

### 📺 TV Display
- Menampilkan dokumen kerja aktif secara realtime di atas lini produksi.
- Berjalan otomatis di peramban TV tanpa login (`/display/[lineId]`).
- Mengirimkan sinyal detak jantung (*heartbeat*) berkala untuk monitoring keandalan.

### 📲 Progressive Web App (PWA)
- Dapat diinstal langsung ke layar utama perangkat (Android Tablet, iPad Safari, Desktop Chrome).
- Dilengkapi custom Service Worker untuk performa tinggi dan halaman fallback saat jaringan offline.

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
|---|---|
| **App Framework** | Next.js 16 (React 19 + TypeScript) |
| **Runtime & Server** | Node.js Custom Server (`server.js`) dengan Express & HTTP |
| **Realtime Engine** | WebSocket via Socket.io (`socket.io` & `socket.io-client`) |
| **Database** | PostgreSQL lokal / on-premise (didukung via Laragon / Docker) |
| **ORM & Data Modeling** | Prisma ORM 6 (`@prisma/client`) |
| **Penyimpanan Berkas** | Local Disk Storage (`./public/uploads/documents/`) |
| **Autentikasi** | Native Session Cookie (`pkis_session`) + HMAC-SHA256 password hashing |
| **Tampilan UI** | Tailwind CSS v4 + Radix UI / shadcn/ui + Lucide Icons |
| **PWA** | Custom Service Worker + Web App Manifest |

---

## 📦 Struktur Proyek

```
PKIS-PLUS/
├── app/
│   ├── admin/                  # Dashboard Admin (workspace, laporan, master data)
│   ├── operator/               # Antarmuka tablet Operator (display dokumen, form input)
│   ├── display/[lineId]/       # Halaman TV Display per lini kerja
│   ├── system/                 # Halaman Status & Monitoring Sistem
│   ├── offline/                # Halaman fallback PWA saat offline
│   └── api/                    # API Route Handlers (Next.js)
│       ├── andon/              # API Panggilan Andon & Leader
│       ├── auth/               # API Login, Logout, dan Session
│       ├── documents/          # CRUD dokumen kerja
│       ├── folders/            # CRUD folder hierarkis
│       ├── lines/              # CRUD data lini produksi (Line)
│       ├── produksi/           # Endpoint modul produksi terpadu
│       ├── system/             # Health check & display heartbeat
│       └── upload/             # Handler upload berkas lokal
├── components/
│   ├── admin/                  # Komponen UI panel admin
│   ├── operator/               # Komponen UI tablet operator
│   └── ui/                     # Komponen reusable shadcn/ui
├── docs/                       # Dokumentasi teknis lengkap proyek
│   ├── 02-system-overview.md   # Gambaran umum sistem
│   ├── API_REFERENCE.md        # Spesifikasi endpoint API
│   ├── DEPLOYMENT.md           # Panduan deployment mandiri / VPS
│   ├── INSTALLATION.md         # Panduan instalasi lokal
│   ├── TESTING.md              # Panduan pengujian & QA
│   └── USER_GUIDE.md           # Panduan penggunaan per role
├── lib/
│   ├── auth.ts                 # Utilitas autentikasi & session token
│   ├── prisma.ts               # Inisialisasi Prisma Client singleton
│   ├── socket.ts               # Client koneksi Socket.io
│   └── services/               # Abstraksi data layer & API helpers
├── prisma/
│   ├── schema.prisma           # Skema deklaratif database PostgreSQL
│   └── seed.js                 # Seeder akun default (admin, operator, leader)
├── public/
│   ├── uploads/                # Direktori penyimpanan berkas dokumen lokal
│   ├── manifest.json           # Konfigurasi PWA Manifest
│   └── service-worker.js       # Service worker PWA
├── server.js                   # Custom Next.js server terintegrasi Socket.io
└── package.json
```

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat
- **Node.js** v18+ (disarankan v20 LTS)
- **PostgreSQL** v14+ aktif (bisa melalui Laragon, Docker, atau PostgreSQL native)

### 2. Instalasi Dependensi
```bash
git clone https://github.com/mahesarahdintyo/PKIS-PLUS.git
cd PKIS-PLUS
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file template lingkungan:
```bash
cp .env.example .env
```
Pastikan variabel `DATABASE_URL` di `.env` mengarah ke database PostgreSQL Anda:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pkis_plus?schema=public"
```

### 4. Setup Database & Inisialisasi Data
Jalankan sinkronisasi skema tabel dan seeder data awal:
```bash
# Generate Prisma Client
npm run db:generate

# Sinkronkan skema tabel ke PostgreSQL
npm run db:push

# Isi data awal (Akun Admin, Operator, Leader & Kategori dokumen dasar)
npm run db:seed
```

> **Akun Bawaan Seeder:**
> - **Admin**: `admin@pabrik.local` (Password: `admin123`)
> - **Operator**: `operator@pabrik.local` (Password: `operator123`)
> - **Leader**: `leader@pabrik.local` (Password: `leader123`)

### 5. Jalankan Aplikasi
```bash
npm run dev
```
Buka peramban di **[http://localhost:3000](http://localhost:3000)**.

---

## 📖 Dokumentasi Lengkap

Dokumentasi terperinci tersedia di folder [`docs/`](file:///c:/laragon/www/PKIS-PLUS/docs/):
- 📘 [Panduan Instalasi Lokal (docs/INSTALLATION.md)](file:///c:/laragon/www/PKIS-PLUS/docs/INSTALLATION.md)
- 📗 [Panduan Pengguna / User Guide (docs/USER_GUIDE.md)](file:///c:/laragon/www/PKIS-PLUS/docs/USER_GUIDE.md)
- 📙 [Referensi API (docs/API_REFERENCE.md)](file:///c:/laragon/www/PKIS-PLUS/docs/API_REFERENCE.md)
- 📕 [Panduan Deployment Produksi (docs/DEPLOYMENT.md)](file:///c:/laragon/www/PKIS-PLUS/docs/DEPLOYMENT.md)
- 📋 [Panduan Pengujian & Checklist (docs/TESTING.md)](file:///c:/laragon/www/PKIS-PLUS/docs/TESTING.md)
- 📓 [System Overview (docs/02-system-overview.md)](file:///c:/laragon/www/PKIS-PLUS/docs/02-system-overview.md)

---

## 📝 Lisensi & Hak Cipta

© 2026 PT FUTABA. Internal use only — all rights reserved.
