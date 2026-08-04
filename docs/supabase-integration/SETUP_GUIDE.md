# 📚 Panduan Setup Lengkap: Integrasi Supabase ke PT ABC Document Center

Panduan ini menjelaskan langkah demi langkah bagaimana mengintegrasikan dan menggunakan aplikasi web dengan Supabase.

---

## 🎯 Apa yang Sudah Dibuat?

Aplikasi web Anda sekarang memiliki integrasi penuh dengan Supabase untuk:
- ✅ Menyimpan data dokumen di database Supabase
- ✅ Menyimpan file dokumen di Supabase Storage
- ✅ Fetch dokumen real-time dari Supabase
- ✅ Upload dokumen langsung ke Supabase Storage
- ✅ Delete dokumen dari database dan storage
- ✅ Download file dengan signed URLs yang aman

---

## 📋 Daftar File dan Fungsinya

### API Routes (Backend)
1. **`/api/documents/route.ts`** - GET/POST documents
   - GET: Fetch semua dokumen dari Supabase
   - POST: Membuat record dokumen baru

2. **`/api/documents/[id]/route.ts`** - DELETE specific document
   - DELETE: Hapus dokumen dan file dari storage

3. **`/api/categories/route.ts`** - GET categories
   - GET: Fetch semua kategori dari Supabase

4. **`/api/upload/route.ts`** - Upload file ke Storage
   - POST: Upload file ke Supabase Storage dan buat document record

5. **`/api/download/route.ts`** - Generate signed URLs
   - POST: Generate secure signed URL untuk download file

### Supabase Clients
- **`/lib/supabase/client.ts`** - Browser client untuk client-side operations
- **`/lib/supabase/server.ts`** - Server client untuk server-side operations

### Components
- **`/components/upload-dialog.tsx`** - Modal untuk upload dokumen baru
- **`/components/document-card.tsx`** - Komponen untuk display dokumen dengan download/delete
- **`/app/page.tsx`** - Main page dengan Supabase integration

---

## 🚀 Cara Menjalankan di Antigravity

### 1. Install Dependencies
Buka terminal di Antigravity dan jalankan:
```bash
cd /path/to/project
pnpm install
```

### 2. Setup Environment Variables
Pastikan file `.env.local` sudah ada dengan variables berikut (sudah auto-setup oleh Supabase integration):
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Jika tidak ada, hubungi tim Supabase untuk mendapatkan keys tersebut.

### 3. Run Development Server
```bash
pnpm dev
```

Server akan berjalan di `http://localhost:3000`

---

## 📝 Cara Menggunakan Aplikasi

### Upload Dokumen Baru

1. **Klik tombol "Upload Document"** di kanan atas header
   
2. **Isi form yang muncul:**
   - **Document Title** (wajib): Nama dokumen, contoh "SOP Customer Service"
   - **Description** (opsional): Deskripsi dokumen
   - **Category** (opsional): Pilih kategori (SOP, Manual, Form, Lainnya)
   - **File** (wajib): Pilih file untuk di-upload (max 50MB)

3. **Klik "Upload"** - Tunggu hingga selesai

4. **Dokumen akan muncul di daftar utama** setelah berhasil diupload

### Mencari Dokumen

1. **Gunakan search bar** di bagian atas
2. **Ketik judul atau deskripsi** dokumen yang ingin dicari
3. Hasil pencarian akan **diupdate secara real-time**

### Filter Kategori

1. **Klik tombol kategori** yang ingin di-filter (Semua, SOP, Manual, Form, Lainnya)
2. Hanya dokumen dengan **kategori yang dipilih** yang akan ditampilkan
3. Klik "Semua" untuk melihat semua dokumen

### Download Dokumen

1. **Klik tombol Download** (icon panah ke bawah) di setiap dokumen
2. Browser akan **otomatis download file** dengan nama aslinya
3. File akan tersimpan di folder Downloads

### Hapus Dokumen

1. **Klik tombol Trash** (icon sampah) di setiap dokumen
2. **Konfirmasi penghapusan** di dialog yang muncul
3. Dokumen dan file akan **dihapus dari Supabase**

---

## 🗄️ Struktur Database Supabase

### Tabel `categories`
Menyimpan daftar kategori dokumen:
```sql
id (INTEGER) - Primary Key
name (TEXT) - Nama kategori (unique)
description (TEXT) - Deskripsi
created_at (TIMESTAMP)
```

**Data Default:**
- SOP - Standard Operating Procedures
- Manual - User Manuals and Guides
- Form - Forms and Templates
- Lainnya - Other Documents

### Tabel `documents`
Menyimpan metadata dokumen:
```sql
id (UUID) - Primary Key
title (TEXT) - Judul dokumen
description (TEXT) - Deskripsi
category_id (INTEGER) - Foreign Key ke categories
file_name (TEXT) - Nama file asli
file_path (TEXT) - Path file di Storage
file_size (INTEGER) - Ukuran file dalam bytes
file_type (TEXT) - MIME type (contoh: application/pdf)
uploaded_by (TEXT) - User yang upload
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

---

## 💾 Supabase Storage Structure

### Bucket: `documents`
Tempat penyimpanan file dokumen dengan struktur:
```
documents/
├── documents/
│   ├── 1720000000-filename1.pdf
│   ├── 1720000001-filename2.docx
│   └── ...
```

File diberi prefix timestamp untuk menghindari collision.

---

## 🔐 Keamanan

### Row Level Security (RLS)
- ✅ **Public Read**: Semua bisa membaca documents dan categories (tidak perlu auth)
- ✅ **Public Write**: Semua bisa upload/delete documents (untuk development, bisa diupdate dengan auth nanti)

Untuk production, update RLS policy agar hanya authenticated users yang bisa write.

### Signed URLs
- File download menggunakan **signed URLs** yang valid 1 jam
- Mencegah direct access ke storage files
- Aman untuk dibagikan tapi terbatas waktu

---

## 🛠️ Troubleshooting

### Error: "Failed to fetch documents"
**Solusi:**
1. Pastikan Supabase connection aktif
2. Check environment variables di `.env.local`
3. Lihat console browser (F12 → Console) untuk error details
4. Pastikan tabel documents dan categories sudah exist di Supabase

### Error: "Upload failed"
**Solusi:**
1. Pastikan file size < 50MB
2. Check apakah `documents` bucket sudah exist di Supabase Storage
3. Lihat console server untuk error details
4. Pastikan internet connection stabil

### Error: "Failed to generate download link"
**Solusi:**
1. Pastikan file masih exist di Supabase Storage
2. Signed URL mungkin expired, coba upload ulang file
3. Check RLS policy di Supabase - pastikan public read enabled

### Categories tidak muncul
**Solusi:**
1. Check apakah data sudah diinsert di tabel `categories`
2. Jalankan query di Supabase editor:
   ```sql
   SELECT * FROM public.categories;
   ```
3. Jika kosong, insert data:
   ```sql
   INSERT INTO public.categories (name, description) VALUES
     ('SOP', 'Standard Operating Procedures'),
     ('Manual', 'User Manuals and Guides'),
     ('Form', 'Forms and Templates'),
     ('Lainnya', 'Other Documents');
   ```

---

## 📊 Flow Diagram

### Upload Document
```
User klik "Upload Document"
↓
Modal form dibuka
↓
User isi form dan pilih file
↓
POST /api/upload (FormData dengan file)
↓
API upload file ke Supabase Storage
↓
API buat document record di database
↓
Return success response
↓
UI refresh document list
↓
Dokumen muncul di daftar
```

### Fetch Documents
```
Page mount
↓
Fetch /api/documents
↓
Fetch /api/categories
↓
Database return documents dan categories
↓
UI render document list dengan categories
```

### Download Document
```
User klik Download button
↓
POST /api/download dengan file path
↓
API generate signed URL (valid 1 jam)
↓
Return signed URL
↓
Browser download file dari signed URL
↓
File tersimpan di Downloads folder
```

---

## 🔄 Update Kategori Baru

Jika ingin tambah kategori baru:

1. **Via Supabase Dashboard:**
   - Buka Supabase Project
   - Klik Table Editor
   - Buka tabel `categories`
   - Klik "Insert Row"
   - Isi name dan description

2. **Via SQL Query:**
   ```sql
   INSERT INTO public.categories (name, description)
   VALUES ('Nama Kategori', 'Deskripsi kategori');
   ```

3. **Kategori akan otomatis muncul** di filter buttons dan dropdown upload

---

## 📦 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (S3-compatible)
- **Icons**: Lucide React

---

## 🆘 Butuh Bantuan?

1. **Check console logs** (F12 → Console tab)
2. **Check Supabase Dashboard** untuk verify data di database
3. **Check network tab** (F12 → Network) untuk melihat API responses
4. **Check server logs** di terminal Antigravity
5. **Refer to Supabase docs** di https://supabase.com/docs

---

## ✨ Next Steps

Untuk enhance aplikasi ini, Anda bisa:

1. **Tambah Authentication** - Hanya admin yang bisa upload/delete
2. **Add Document Sharing** - Share dokumen dengan users lain
3. **Add Comments/Notes** - Tambah comments di setiap dokumen
4. **Add Version Control** - Track history upload dokumen
5. **Add Analytics** - Track berapa kali dokumen di-download
6. **Improve Search** - Full-text search capabilities
7. **Add Document Preview** - Preview PDF/images sebelum download

---

**Happy documenting! 📚✨**
