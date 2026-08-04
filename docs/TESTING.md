# ✅ Panduan Pengujian (Testing Guide)

Dokumen ini memandu pengembang atau tim QA untuk memverifikasi fungsionalitas aplikasi **Futaba Digital Document Management System** baik secara otomatis (type checking & build validation) maupun manual.

---

## ⚙️ 1. Pengujian Otomatis & Kompilasi

Sebelum mengajukan perubahan kode ke cabang produksi, lakukan pengujian berikut di terminal lokal Anda:

### A. Validasi TypeScript (Type Safety Check)
Pastikan tidak ada kesalahan tipe data pada kode TypeScript:
```bash
npx tsc --noEmit
```
*Hasil yang diharapkan: Perintah selesai tanpa output kesalahan (clean exit).*

### B. Validasi Build Produksi (Production Build Check)
Pastikan aplikasi Next.js dapat dikompilasi ke versi produksi dengan lancar:
```bash
npm run build
```
*Hasil yang diharapkan: Build berhasil (`Compiled successfully`) dan semua halaman statis/dinamis terbuat tanpa warning fatal.*

---

## 📝 2. Skenario Pengujian Manual (Manual Verification Checklist)

Jalankan server lokal (`pnpm dev` atau `npm run start`) lalu verifikasi fungsionalitas berikut di browser:

### 👑 A. Halaman Admin (`/admin`)

#### 1. Navigasi & Folder
- [ ] Pilih salah satu Land (misal: 500T). Pastikan masuk ke halaman workspace Land.
- [ ] Buat folder baru. Pastikan folder muncul di daftar.
- [ ] Klik folder untuk memasukinya. Pastikan navigasi breadcrumb di atas terisi dengan benar.
- [ ] Klik ikon tempat sampah pada folder untuk menghapusnya. Pastikan folder hilang dari daftar.

#### 2. Unggah Dokumen (Upload)
- [ ] Klik **Upload Document**.
- [ ] Coba unggah file dengan format tidak valid (selain PDF, JPG, PNG). Pastikan muncul pesan error.
- [ ] Coba unggah file berukuran di atas 50MB. Pastikan muncul pesan error.
- [ ] Unggah file PDF/JPG/PNG yang valid. Masukkan judul dan deskripsi. Pastikan file muncul di daftar dokumen setelah proses unggah selesai.

#### 3. Edit Judul & Nama File (Inline Edit)
- [ ] Pada kartu dokumen, klik tombol **Pencil** di samping judul utama dokumen. Pastikan input teks muncul dan terisi dengan judul saat ini.
- [ ] Ubah judul, lalu klik ikon **Save** (atau tekan Enter). Pastikan judul terupdate di kartu dokumen.
- [ ] Ulangi langkah di atas tetapi klik tombol **Batal** (atau tekan Escape). Pastikan judul kembali ke nilai semula.
- [ ] Klik tombol **Pencil** di samping nama file asli (bagian bawah). Pastikan input teks muncul tanpa menampilkan ekstensi file (misal: hanya `manual-kerja`).
- [ ] Ubah nama file, lalu klik ikon **Save** (atau tekan Enter). Pastikan nama file terupdate lengkap dengan ekstensinya (misal: `manual-kerja-baru.pdf`).

#### 4. Waktu Target & Visibilitas Operator
- [ ] Pilih tanggal dan jam target, lalu klik **Simpan**. Pastikan teks target waktu tertera di kartu dokumen.
- [ ] Klik tombol **Reset**. Pastikan target waktu hilang.
- [ ] Klik ikon mata coret untuk menyembunyikan dokumen dari operator. Pastikan warna kartu berubah menjadi kekuningan dan terdapat lencana "Disembunyikan dari operator".

#### 5. Penghapusan Dokumen
- [ ] Klik ikon **Trash** pada dokumen. Konfirmasi dialog. Pastikan dokumen tersebut hilang dari daftar admin dan berkas fisiknya terhapus dari bucket Supabase Storage.

---

### 📱 B. Halaman Operator (`/operator`)

- [ ] Buka halaman operator di tab browser baru.
- [ ] Navigasikan masuk ke dalam folder. Pastikan folder dan dokumen yang ada di admin (yang tidak disembunyikan) muncul.
- [ ] Lakukan pencarian dokumen pada search bar. Pastikan filter pencarian berjalan instan.
- [ ] Klik tombol **Preview** pada dokumen. Pastikan dokumen terbuka di tab baru.
- [ ] Pastikan dokumen yang diset **hidden** di halaman admin **tidak muncul** sama sekali di halaman operator.

#### Laporan Produksi & Part Number Realtime
- [ ] Buka halaman admin tab **Part Number** dan halaman operator tab **Laporan Produksi** di dua tab browser.
- [ ] Tambah part number baru dari admin. Pastikan dropdown part number operator bertambah otomatis tanpa refresh.
- [ ] Hapus part number dari admin. Pastikan dropdown operator berkurang otomatis tanpa refresh.
- [ ] Buka halaman admin tab **Laporan Produksi** dan halaman operator tab **Laporan Produksi** di dua tab browser.
- [ ] Submit laporan produksi dari operator. Pastikan laporan baru muncul otomatis di dashboard admin tanpa refresh browser.

---

### 📺 C. Halaman Display TV (`/display`)

- [ ] Buka halaman display TV di tab browser terpisah.
- [ ] Pada halaman operator, klik tombol **Tampilkan** pada salah satu dokumen.
- [ ] Pastikan halaman display TV **seketika memuat** dan menampilkan dokumen tersebut tanpa perlu melakukan refresh halaman.
- [ ] Pada halaman admin, coba edit judul atau nama file dokumen yang sedang ditampilkan di TV tersebut.
- [ ] Pastikan halaman display TV langsung memperbarui metadata judul/nama file yang berubah secara realtime.
