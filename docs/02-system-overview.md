# Futaba PKIS — System Overview

## Tujuan

Sistem informasi produksi dan manajemen dokumen digital untuk **PT FUTABA** yang memungkinkan:
1. Operator di lini produksi menampilkan dokumen kerja (SOP, Drawing, IK) ke layar TV Display secara realtime via tablet.
2. Operator mencatat laporan produksi harian, downtime, andon call, dan log aktivitas secara langsung.
3. Manajemen dan Admin memantau kinerja lini, kehadiran, produktivitas, scrap, andon, dan status display TV secara terpusat.

---

## Line (Lini Produksi)

- Lini produksi dikonfigurasi secara dinamis (contoh: 500T, 800T, 2000T, Line Welder, dll.).
- Setiap Line terhubung dengan:
  - **1 Tablet Operator** (input laporan, kontrol display dokumen, andon call)
  - **1 TV Display** (menampilkan dokumen kerja aktif secara otomatis)

---

## Peran Pengguna (Roles)

### Operator
- Membuka dan mencari dokumen kerja sesuai lini/mesin.
- Mengirim dokumen kerja aktif ke TV Display secara realtime.
- Mengisi laporan produksi, downtime, dan andon call.

### Leader
- Menerima dan merespons panggilan Andon dari operator.
- Memantau status berjalan lini dan verifikasi rencana produksi.

### Admin
- Mengunggah & mengelola dokumen, folder, dan kategori per lini.
- Mengelola data master (Line, Part Number, Kategori NG, User & Hak Akses).
- Memantau laporan produksi, dashboard analitik, dan status perangkat display TV (`/system`).

---

## TV Display

TV Display dipasang di area lini kerja:
- Membuka halaman `/display/[lineId]` di browser TV tanpa memerlukan login.
- Menampilkan dokumen aktif secara realtime (< 1 detik update melalui WebSocket Socket.io).

---

## Penyimpanan Dokumen (File Storage)

- Jenis berkas didukung: PDF, JPG, JPEG, PNG.
- File disimpan di penyimpanan lokal server (`public/uploads/documents/`) dengan dukungan recycle bin terpusat.

---

## Arsitektur Teknologi

- **Frontend & App Framework**: Next.js 16 (React 19 + TypeScript) + Tailwind CSS + shadcn/ui
- **Backend & Server**: Custom Node.js Server (`server.js`) dengan Express & Socket.io
- **Database & ORM**: PostgreSQL lokal / self-hosted dengan Prisma ORM
- **Realtime Engine**: WebSocket / Socket.io (`/api/socket`)
- **Autentikasi**: Session-based cookie auth dengan hashing terproteksi (tanpa dependensi eksternal cloud)
- **PWA**: Custom Service Worker + Web App Manifest