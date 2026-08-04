# 🔌 Referensi API (API Reference)

Dokumen ini mendokumentasikan semua API Endpoints yang tersedia pada aplikasi **Futaba PKIS**.

> Semua endpoint menggunakan **Next.js Route Handlers** (`app/api/`) dan berkomunikasi dengan Supabase PostgreSQL sebagai database.

---

## 🏭 Lini Produksi (Lands)

### `GET /api/lands`
Mengambil daftar semua lini produksi (lands).

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `includeHidden` | boolean | Sertakan lini yang disembunyikan (default: `false`) |

**Response `200`:**
```json
[{ "id": "500T", "name": "Line 500T", "description": "..." }]
```

---

## 📂 Folder

### `GET /api/folders`
Mengambil daftar folder dalam suatu lini atau subfolder.

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `landId` | string | **(Wajib)** ID lini produksi |
| `parentId` | number | ID folder induk (null = root) |
| `search` | string | Kata kunci pencarian nama folder |
| `includeAll` | boolean | Abaikan filter kedalaman jika `true` |

---

## 📄 Dokumen

### `GET /api/documents`
Mengambil daftar dokumen berdasarkan filter.

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `landId` | string | Filter berdasarkan lini |
| `folderId` | number | Filter berdasarkan folder |
| `search` | string | Pencarian judul/deskripsi/nama file |
| `includeHidden` | boolean | Sertakan dokumen tersembunyi (default: `false`) |

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "title": "SOP Perakitan Awal",
    "description": "...",
    "category": "SOP",
    "type": "application/pdf",
    "file": { "name": "sop-v2.pdf", "path": "documents/...", "size": 1048576 },
    "targetTime": "2026-07-15T08:00:00.000Z",
    "hiddenFromOperator": false
  }
]
```

### `PATCH /api/documents/[id]`
Update metadata dokumen (judul, nama file, target waktu, visibilitas).

**Request Body:**
```json
{
  "title": "Judul Baru",
  "file_name": "nama-baru.pdf",
  "target_time": "2026-07-20T08:00:00.000Z",
  "hidden_from_operator": false
}
```

### `DELETE /api/documents/[id]`
Hapus dokumen dari database **dan** storage bucket secara permanen.

---

## 📊 Laporan Produksi

### `GET /api/production-reports`
Mengambil semua laporan produksi.

**Query Parameters:**
| Parameter | Tipe | Keterangan |
|---|---|---|
| `landId` | string | Filter berdasarkan lini |
| `startDate` | string | Tanggal awal filter (YYYY-MM-DD) |
| `endDate` | string | Tanggal akhir filter (YYYY-MM-DD) |

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "land_id": "500T",
    "report_date": "2026-07-13",
    "shift": "Shift 1",
    "operator_name": "Operator",
    "start_time": "08:00:00",
    "end_time": "16:00:00",
    "part_number": "FTB-001-A",
    "qty": 150,
    "ng_qty": 3,
    "ng_category": "Dimensi",
    "break_minutes": 60,
    "created_at": "2026-07-13T01:00:00Z",
    "land": { "name": "Line 500T" }
  }
]
```

### `POST /api/production-reports`
Simpan laporan produksi baru (digunakan operator).

**Request Body:**
```json
{
  "land_id": "500T",
  "report_date": "2026-07-13",
  "shift": "Shift 1",
  "operator_name": "Operator",
  "start_time": "08:00:00",
  "end_time": "16:00:00",
  "part_number": "FTB-001-A",
  "qty": 150,
  "ng_qty": 3,
  "ng_category": "Dimensi",
  "break_minutes": 60
}
```

**Validasi:**
- `qty` tidak boleh 0
- `ng_qty` tidak boleh melebihi `qty`
- `ng_category` wajib diisi jika `ng_qty > 0`

**Response `201`:**
```json
{ "id": "uuid", "...": "..." }
```

### `DELETE /api/production-reports/[id]`
Hapus laporan produksi berdasarkan ID (admin only).

---

## 🔢 Part Number

### `GET /api/part-numbers`
Mengambil semua part number yang aktif (public — dapat diakses operator).

**Response `200`:**
```json
[{ "id": "uuid", "code": "FTB-001-A", "description": "Part number tipe A" }]
```

### `POST /api/part-numbers`
Tambah part number baru. **(Memerlukan login admin)**

**Request Body:**
```json
{ "code": "FTB-004-D", "description": "Deskripsi opsional" }
```

### `DELETE /api/part-numbers?id=[id]`
Hapus part number berdasarkan ID. **(Memerlukan login admin)**

---

## 🏷️ Kategori NG

### `GET /api/ng-categories`
Mengambil semua kategori NG yang aktif (public — dapat diakses operator).

**Response `200`:**
```json
[{ "id": "uuid", "name": "Dimensi", "description": "Cacat dimensi/ukuran" }]
```

### `POST /api/ng-categories`
Tambah kategori NG baru. **(Memerlukan login admin)**

**Request Body:**
```json
{ "name": "Dimensi", "description": "Deskripsi opsional" }
```

**Response `201`:**
```json
{ "id": "uuid", "name": "Dimensi", "description": "...", "created_at": "..." }
```

### `DELETE /api/ng-categories?id=[id]`
Hapus kategori NG berdasarkan ID. **(Memerlukan login admin)**

---

## 💾 Upload & Download

### `POST /api/upload`
Unggah file ke Supabase Storage + buat record dokumen di database.

**Request Body (`multipart/form-data`):**
| Field | Tipe | Keterangan |
|---|---|---|
| `file` | File | PDF/JPG/PNG, maks 50MB |
| `title` | string | **(Wajib)** Judul dokumen |
| `description` | string | Keterangan (opsional) |
| `landId` | string | **(Wajib)** ID lini |
| `folderId` | number | ID folder tujuan (opsional) |
| `targetTime` | string | Target waktu ISO (opsional) |

**Response `201`:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": { "id": "uuid", "title": "...", "file_name": "...", "file_path": "..." }
}
```

### `POST /api/download`
Hasilkan Signed URL (berlaku 1 jam) untuk mengakses file di storage.

**Request Body:**
```json
{ "filePath": "documents/1720000000-file.pdf" }
```

**Response `200`:**
```json
{ "success": true, "url": "https://...supabase.co/storage/v1/object/sign/..." }
```

---

## 📺 Display Document

### `GET /api/display-document?landId=[landId]`
Mengambil dokumen yang sedang aktif ditampilkan di TV Display untuk lini tertentu.

### `POST /api/display-document`
Mengatur dokumen aktif untuk TV Display (dikirim operator saat menekan tombol Tampilkan).

**Request Body:**
```json
{ "landId": "500T", "documentId": "uuid" }
```

---

## ❤️ System Health

### `GET /api/system/health`
Cek status koneksi server & database. Dipakai halaman System Status.

### `POST /api/system/display-heartbeat`
Kirim heartbeat dari TV Display agar admin bisa memantau status online/offline layar.

---

## 🗂️ Kategori Dokumen

### `GET /api/categories`
Mengambil semua kategori dokumen (SOP, Manual, Form, Lainnya).
