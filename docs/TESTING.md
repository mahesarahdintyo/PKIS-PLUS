# ✅ Panduan Pengujian (Testing Guide) — PKIS-PLUS

Dokumen ini memandu pengembang dan tim QA untuk memverifikasi fungsionalitas aplikasi **Futaba PKIS (PKIS-PLUS)**, mencakup pengujian kompilasi otomatis (*type check & build*) serta skenario verifikasi manual terstruktur.

---

## ⚙️ 1. Pengujian Otomatis & Kompilasi Kode

Sebelum mengajukan commit atau melakukan deployment ke server produksi, jalankan langkah validasi berikut di terminal:

### A. Validasi TypeScript (Type Safety Check)
Memastikan seluruh komponen, API routes, dan model Prisma bebas dari kesalahan tipe:
```bash
npx tsc --noEmit
```
*Hasil yang diharapkan: Perintah selesai tanpa output kesalahan (exit code 0).*

### B. Validasi Kompilasi Produksi (Production Build Check)
Memastikan Next.js dapat mengompilasi seluruh rute statis dan dinamis dengan sukses:
```bash
npm run build
```
*Hasil yang diharapkan: Menampilkan pesan `Compiled successfully` dan ringkasan seluruh routes (exit code 0).*

### C. Validasi Skema Database (Prisma Validate)
Memastikan file `prisma/schema.prisma` konsisten dan sinkron dengan client:
```bash
npx prisma validate
```

---

## 📝 2. Skenario Pengujian Manual (Manual Verification Checklist)

Jalankan server aplikasi lokal:
```bash
npm run dev
```
Buka peramban di `http://localhost:3000`.

---

### 👑 A. Halaman Admin (`/admin`)

#### 1. Manajemen Lini (Line) & Folder
- [ ] Buka tab **Workspace**, pilih salah satu Line (misal: *Line 500T*).
- [ ] Buat folder baru (misal: *Folder SOP Press*). Pastikan folder langsung tampil di daftar.
- [ ] Klik folder untuk masuk ke dalamnya. Pastikan tautan breadcrumb di atas terisi dengan tepat.
- [ ] Uji buat sub-folder di dalam folder tersebut.

#### 2. Unggah & Manajemen Dokumen
- [ ] Klik tombol **Upload Document**.
- [ ] Coba unggah file dengan ekstensi selain PDF, JPG, atau PNG (misal `.exe` atau `.txt`). Pastikan sistem menolak dengan pesan validasi.
- [ ] Unggah file PDF valid. Beri judul dan deskripsi.
- [ ] Pastikan file muncul di daftar dokumen dan berkas fisik tersimpan di direktori lokal `public/uploads/documents/`.
- [ ] Klik ikon **Pensil** di samping judul dokumen. Ubah judul lalu simpan. Pastikan judul terbarui seketika.
- [ ] Klik ikon **Mata Coret** untuk menyembunyikan dokumen dari operator. Pastikan kartu dokumen ditandai berstatus tersembunyi.
- [ ] Klik ikon **Trash** pada kartu dokumen. Pastikan dokumen berpindah ke tempat sampah (*Recycle Bin*).

#### 3. Tempat Sampah (Recycle Bin)
- [ ] Akses halaman `/admin/recycle-bin`.
- [ ] Verifikasi dokumen atau folder yang baru saja dihapus muncul di daftar sampah.
- [ ] Uji fitur **Restore** (dokumen kembali ke workspace).
- [ ] Uji fitur **Purge** (dokumen dihapus permanen dari database dan file fisik terhapus dari disk).

#### 4. Master Data Part Number & Kategori NG
- [ ] Tambah part number baru di tab **Part Number**.
- [ ] Tambah kategori cacat baru di tab **Kategori NG**.
- [ ] Pastikan data tersimpan di PostgreSQL dan tampil di tabel admin.

---

### 📱 B. Halaman Operator (`/operator`)

- [ ] Login menggunakan akun operator (`operator@pabrik.local`).
- [ ] Masuk ke menu lini kerja terkait.
- [ ] Pastikan dokumen yang disembunyikan (*hidden*) oleh admin **tidak muncul** pada tampilan operator.
- [ ] Buka fitur **Preview** pada salah satu dokumen kerja. Pastikan dokumen terbuka dengan benar di peramban.

#### Realtime Synchronization Test (Multi-Tab)
- [ ] Buka tab Browser 1: Halaman Admin (Tab Part Number).
- [ ] Buka tab Browser 2: Halaman Operator (Form Laporan Produksi).
- [ ] Tambahkan part number baru di Browser 1. Perhatikan dropdown part number di Browser 2 bertambah secara otomatis tanpa perlu merefresh halaman.
- [ ] Buka tab Browser 1: Halaman Admin (Tab Laporan Produksi).
- [ ] Di Browser 2 (Operator), isi formulir produksi dan klik **Simpan Laporan**.
- [ ] Perhatikan tabel laporan di Browser 1 langsung memperbarui baris baru secara otomatis.

---

### 📺 C. TV Display Realtime (`/display/[lineId]`)

- [ ] Buka tab Browser 1: Halaman Operator (`/operator`).
- [ ] Buka tab Browser 2: Halaman Display TV (`/display/500T`).
- [ ] Pada Browser 1, pilih salah satu dokumen kerja dan klik tombol **Tampilkan** (ikon monitor hijau).
- [ ] Verifikasi Browser 2 (TV Display) langsung memuat dan menampilkan dokumen tersebut dalam hitungan < 1 detik melalui koneksi Socket.io.
- [ ] Di halaman admin, ubah judul dokumen yang sedang aktif ditampilkan. Pastikan teks judul di TV Display terbarui secara realtime.

---

### 🖥️ D. Pemantauan Sistem (`/system`)

- [ ] Buka halaman `/system` saat TV Display sedang aktif di tab lain.
- [ ] Verifikasi status TV Display lini tersebut ditandai **Online** dengan indikator hijau.
- [ ] Tutup tab TV Display dan tunggu 1 menit (melewati siklus heartbeat). Status TV Display akan berubah menjadi **Offline**.
- [ ] Periksa indikator status database PostgreSQL dan direktori penyimpanan berkas menunjukkan status **Healthy / Normal**.
