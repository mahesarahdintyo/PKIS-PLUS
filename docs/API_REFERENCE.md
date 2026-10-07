# 🔌 Referensi API (API Reference) — PKIS-PLUS

Dokumen ini mendokumentasikan API Endpoints yang tersedia pada aplikasi **Futaba PKIS (PKIS-PLUS)**.

> Semua endpoint menggunakan **Next.js Route Handlers** (`app/api/`), terhubung ke **PostgreSQL lokal** melalui **Prisma ORM**, dan didukung oleh event bus realtime **Socket.io**.

---

## 🔐 1. Autentikasi (`/api/auth`)

Sistem menggunakan session-based authentication dengan cookie HTTP-only (`pkis_session`) dan enkripsi password HMAC-SHA256.

### `POST /api/auth/login`
Melakukan otentikasi user (Admin, Operator, atau Leader).

**Request Body (`application/json`):**
```json
{
  "username": "admin@pabrik.local",
  "password": "admin123"
}
```
*(Input `username` dapat berupa email lengkap atau alias nama pengguna).*

**Response `200`:**
```json
{
  "success": true,
  "role": "admin",
  "lineId": null,
  "user": {
    "id": "uuid",
    "email": "admin@pabrik.local"
  }
}
```

### `POST /api/auth/logout`
Menghapus session token dari database dan membersihkan session cookie.

### `GET /api/auth/me`
Mendapatkan profil dan role dari user yang sedang login via session cookie.

---

## 🏭 2. Lini Produksi (`/api/lines`)

Mengelola data lini produksi (sebelumnya dinamai *lands*).

### `GET /api/lines`
Mengambil seluruh daftar lini produksi yang terdaftar.

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `includeHidden` | boolean | Sertakan lini yang disembunyikan dari operator (default: `false`) |

**Response `200`:**
```json
[
  {
    "id": "500T",
    "name": "Line 500T",
    "description": "Lini Press 500 Ton",
    "machine_type": "500T",
    "is_active": true
  }
]
```

### `POST /api/lines`
Membuat atau mendaftarkan lini produksi baru (Admin only).

---

## 📂 3. Folder Dokumen (`/api/folders`)

### `GET /api/folders`
Mengambil daftar folder hierarkis dalam suatu lini.

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `lineId` | string | **(Wajib)** ID lini produksi |
| `parentId` | number/string | ID folder induk (`null` untuk root folder) |
| `search` | string | Pencarian nama folder |

### `POST /api/folders`
Membuat folder baru di dalam suatu lini.

### `DELETE /api/folders`
Menghapus folder beserta sub-folder atau dokumen di dalamnya.

---

## 📄 4. Dokumen Kerja (`/api/documents`)

### `GET /api/documents`
Mengambil daftar dokumen kerja berdasarkan filter lini dan folder.

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `lineId` | string | Filter berdasarkan lini |
| `folderId` | number | Filter berdasarkan folder |
| `search` | string | Pencarian judul / nama file |
| `includeHidden` | boolean | Sertakan dokumen tersembunyi (default: `false`) |

### `PATCH /api/documents/[id]`
Memperbarui metadata dokumen (judul, nama file display, target time, visibilitas operator).

### `DELETE /api/documents/[id]`
Menghapus dokumen (memindahkan ke recycle bin atau menghapus permanen dari storage lokal).

---

## 💾 5. Upload, Download, & Print (`/api/upload`, `/api/download`)

### `POST /api/upload`
Mengunggah berkas kerja (PDF, JPG, PNG) ke server lokal (`public/uploads/documents/`) dan membuat entri dokumen di database.

**Request Body (`multipart/form-data`):**
| Field | Tipe | Keterangan |
|---|---|---|
| `file` | File | Berkas PDF / JPG / PNG (maks. 50MB) |
| `title` | string | **(Wajib)** Judul dokumen |
| `lineId` | string | **(Wajib)** ID lini |
| `folderId` | number | ID folder tujuan (opsional) |
| `description`| string | Keterangan tambahan (opsional) |
| `targetTime` | string | Target waktu ISO 8601 (opsional) |

**Response `201`:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "id": "uuid",
    "title": "SOP Mesin 500T",
    "file_name": "sop_500t.pdf",
    "file_path": "documents/1720000000_sop_500t.pdf"
  }
}
```

### `POST /api/download`
Menyediakan path berkas lokal yang aman untuk diakses/dibaca oleh browser/viewer.

**Response `200`:**
```json
{
  "success": true,
  "url": "/uploads/documents/1720000000_sop_500t.pdf"
}
```

### `POST /api/print-file`
Menyediakan buffer file langsung untuk keperluan pencetakan dokumen.

---

## 📺 6. TV Display (`/api/display-document`)

### `GET /api/display-document?lineId=[lineId]`
Mengambil informasi dokumen yang sedang aktif ditayangkan di TV Display untuk lini tertentu.

### `POST /api/display-document`
Mengubah dokumen yang sedang aktif ditampilkan di TV Display (dipanggil operator saat menekan tombol **Tampilkan**). Sekaligus memicu event realtime Socket.io ke TV Display lini terkait.

**Request Body:**
```json
{
  "lineId": "500T",
  "documentId": "uuid-dokumen"
}
```

---

## 📊 7. Modul Produksi Modern (`/api/produksi/*`)

Modul ini mengelola siklus operasional produksi pabrik secara komprehensif:

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/produksi/logs` | `GET`, `POST`, `PATCH`, `DELETE` | Catatan produksi berjalan (Part Number, QTY, NG, waktu mulai/selesai, Manpower) |
| `/api/produksi/downtime` | `GET`, `POST`, `DELETE` | Log downtime mesin (kategori problem, penyebab, countermeasure) |
| `/api/produksi/planning` | `GET`, `POST`, `PATCH` | Perencanaan jadwal produksi per mesin/shift |
| `/api/produksi/attendance`| `GET`, `POST` | Data absensi kehadiran dan lembur operator per shift |
| `/api/produksi/productivity`| `GET`, `POST` | Data referensi produktivitas harian (EH Jam) |
| `/api/produksi/safety` | `GET`, `POST` | Log insiden keselamatan kerja (Safety accident / near-miss) |
| `/api/produksi/scrap` | `GET`, `POST` | Data akumulasi scrap nilai rupiah bulanan |
| `/api/produksi/part-numbers`| `GET`, `POST` | Master part number spesifik per tipe mesin beserta output ratio |
| `/api/produksi/master-data` | `GET` | Pengambilan master data terpadu untuk form operator |
| `/api/produksi/sync-offline`| `POST` | Sinkronisasi antrean laporan yang dibuat operator saat jaringan terputus |

---

## 🚨 8. Sistem Andon & Notifikasi (`/api/andon/*`, `/api/push/*`)

### `GET /api/andon/calls`
Mengambil daftar panggilan Andon aktif di lantai produksi.

### `POST /api/andon/calls`
Membuat panggilan Andon baru oleh operator ketika terjadi kendala mesin/material/kualitas. Secara otomatis memicu notifikasi realtime dan Web Push ke para Leader terkait.

### `PATCH /api/andon/calls`
Leader merespons / mengonfirmasi (acknowledge / solve) panggilan Andon.

### `POST /api/push/send-andon`
Mengirim notifikasi Web Push ke browser perangkat Leader yang telah berlangganan (*push subscription*).

---

## 🗑️ 9. Recycle Bin Admin (`/api/admin/recycle-bin`)

### `GET /api/admin/recycle-bin`
Melihat daftar dokumen, folder, dan entri data yang dihapus sementara (*soft delete*).

### `POST /api/admin/recycle-bin`
Memulihkan (*restore*) atau menghapus secara permanen (*purge*) data beserta berkas fisik terkait.

---

## ❤️ 10. Monitoring & Health Check (`/api/system/*`)

### `GET /api/system/health`
Memeriksa status kesehatan server, akses koneksi PostgreSQL via Prisma, dan kesiapan direktori upload file.

**Response `200`:**
```json
{
  "status": "healthy",
  "database": "connected",
  "storage": "accessible",
  "timestamp": "2026-10-07T07:00:00.000Z"
}
```

### `POST /api/system/display-heartbeat`
Menerima sinyal detak jantung (*heartbeat*) berkala dari TV Display setiap 30 detik untuk menandai status online/offline di dashboard monitoring `/system`.

---

## ⚡ 11. WebSocket Realtime (Socket.io)

Aplikasi menyertakan Socket.io server yang berjalan berdampingan di `server.js`:

- **Path WebSocket**: `/api/socket`
- **Rooms**:
  - `line:[lineId]` — Room komunikasi spesifik lini (pembaruan dokumen display TV)
  - `mesin:[mesinId]` — Room aktivitas spesifik mesin
- **Events Utama**:
  - `join:line` (Client -> Server): TV Display atau Tablet bergabung ke channel lini
  - `display:update` (Server -> Client): Memberitahukan TV Display untuk merender dokumen baru seketika
  - `andon:created` (Server -> Client): Siaran panggilan andon baru ke dashboard pengawas
  - `production:updated` (Server -> Client): Pembaruan realtime log produksi
