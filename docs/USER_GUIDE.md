# 📚 Panduan Pengguna (User Guide)

Aplikasi **Futaba PKIS** memiliki tiga peran utama: **Admin**, **Operator**, dan **TV Display**. Dokumen ini menjelaskan cara penggunaan lengkap untuk setiap peran.

---

## 🔑 1. Login & Autentikasi

Buka aplikasi di browser dan masukkan **username** dan **password** yang telah dibuat oleh admin sistem.

- **Admin** → diarahkan ke halaman `/admin`. Tersedia shortcut ke **Status & Monitoring Sistem** (`/system`) di halaman utama setelah login.
- **Operator** → diarahkan ke halaman `/operator`
- **TV Display** → buka langsung `/display/[landId]` tanpa login (read-only)

### 📲 Install Aplikasi (PWA)

Saat membuka halaman login, tombol **"Install Aplikasi Futaba PKIS"** akan muncul di bawah form jika browser mendukung instalasi PWA.

- **Android / Chrome / Tablet**: Klik tombol → ikuti panduan instalasi browser.
- **iOS / iPad Safari**: Klik tombol → ikuti instruksi tekan **Share ⎋** → **"Add to Home Screen"**.

Setelah diinstal, aplikasi dapat dibuka langsung dari layar utama perangkat tanpa membuka browser secara manual.

---

## 👑 2. Panduan Admin

Halaman Admin memiliki lima tab utama di navigation bar sidebar:

### Tab A: Workspace — Manajemen Dokumen

#### 🗺️ Navigasi Land & Folder
- Di halaman awal, pilih **Land** (lini produksi) yang ingin dikelola, contoh: **500T**, **800T**.
- Gunakan **breadcrumb** di bagian atas workspace untuk melihat posisi folder saat ini dan navigasi kembali ke folder induk.

#### 📁 Pengelolaan Folder
- **Buat Folder**: Klik tombol **Create Folder** di header, masukkan nama, simpan.
- **Hapus Folder**: Klik ikon hapus pada kartu folder.

#### 📄 Pengelolaan Dokumen
**Upload Dokumen Baru:**
1. Klik **Upload Document** di header kanan atas.
2. Isi formulir: Judul, Deskripsi (opsional), Target Waktu (opsional), pilih file (PDF/JPG/PNG, maks 50MB per file, maks 5 file sekaligus).
3. Klik **Upload**.

**Edit Judul & Nama File (Inline Edit):**
- Klik ikon **Pencil** di samping judul → ubah judul → Enter atau klik centang.
- Klik ikon **Pencil** di samping nama file → ubah nama (ekstensi dipertahankan otomatis) → Enter.

**Visibilitas Operator:**
- Klik ikon mata coret untuk **menyembunyikan** dokumen dari operator (berguna untuk draft).
- Klik kembali untuk **menampilkan**.

**Hapus Dokumen:**
- Klik ikon **Trash** (merah) → konfirmasi di pop-up → dokumen dihapus dari database dan storage.

---

### Tab B: Laporan Produksi

Dashboard untuk memantau semua laporan harian yang dikirim operator.

Dashboard akan memperbarui daftar laporan secara otomatis saat operator menyimpan laporan baru. Admin tidak perlu melakukan refresh browser; tombol **Perbarui** tetap tersedia untuk refresh manual jika koneksi realtime sedang bermasalah.

#### 🔍 Filter & Pencarian
- **Filter Lini/Card**: Dropdown pilih lini produksi tertentu.
- **Filter Tanggal**: Tentukan rentang tanggal.
- **Filter Shift**: Pilih Shift 1 atau Shift 2.
- **Pencarian**: Ketik nama operator atau part number.

#### 📊 Tabel Laporan
Kolom yang ditampilkan: **Tanggal**, **Line/Card**, **Operator**, **Shift**, **Part Number**, **Mulai–Selesai**, **QTY OK**, **QTY NG**, **NG Rate**, **Aksi**.

- Klik ikon **mata** untuk melihat detail laporan lengkap (termasuk kategori NG).
- Klik ikon **hapus** untuk menghapus laporan (dengan konfirmasi modal).

#### 📋 Salin & Export
- Di modal detail laporan, klik **Salin Laporan** untuk menyalin teks laporan ke clipboard.
- Klik tombol **Export CSV** di header tabel untuk mengunduh semua laporan yang terfilter.

---

### Tab C: Part Number — Manajemen Part Number

Panel untuk mengelola daftar part number yang bisa dipilih operator.

- **Tambah**: Isi kode part number + deskripsi (opsional) → klik **Simpan Part Number**.
- **Hapus**: Klik ikon **Trash** pada baris yang ingin dihapus → konfirmasi modal.

> Part number yang dihapus tidak lagi muncul di form operator. Laporan lama yang sudah memakai part number tersebut tidak terpengaruh.

Dropdown part number di halaman operator ikut tersinkron otomatis saat admin menambah atau menghapus part number. Jika part number yang sedang dipilih operator dihapus, pilihan akan dikosongkan dan operator perlu memilih ulang.

---

### Tab D: Kategori NG — Manajemen Kategori Cacat

Panel untuk mengelola daftar kategori cacat (NG) yang bisa dipilih operator saat ada produk NG.

- **Tambah**: Isi nama kategori + deskripsi (opsional) → klik **Simpan Kategori NG**.
- **Hapus**: Klik ikon **Trash** → konfirmasi modal.

> Contoh kategori: Dimensi, Permukaan, Material, Proses, Lainnya.

---

### Halaman System Monitoring (`/system`)

Halaman khusus admin untuk memantau kondisi sistem secara menyeluruh. Dapat diakses dari halaman utama setelah login sebagai admin.

- **Status Database & Storage**: Cek koneksi ke Supabase (PostgreSQL & Storage Bucket).
- **Status TV Display per Lini**: Lihat status online/offline setiap TV Display beserta waktu terakhir terlihat aktif.
- **Refresh Manual**: Klik tombol **Refresh** untuk memperbarui status secara manual.

---

## 📱 3. Panduan Operator (Tablet)

Halaman operator diakses via tablet di masing-masing lini produksi.

### A. Form Laporan Produksi

**Langkah pengisian:**
1. **Pilih Part Number** dari dropdown — sistem otomatis mengisi waktu mulai.
2. **Lakukan produksi** sesuai durasi sesi.
3. Tekan **Finish** saat selesai — sistem otomatis mengisi waktu selesai.
4. **Isi QTY** (jumlah total produksi). Wajib diisi dan tidak boleh 0.
5. **Isi NG** (jumlah produk cacat). Jika NG > 0:
   - Secara otomatis muncul pilihan **Kategori NG** (chip/tombol pilihan).
   - Pilih satu kategori yang sesuai — **wajib dipilih** sebelum bisa menyimpan.
   - Jika NG dikembalikan ke 0, pilihan kategori akan hilang otomatis.
6. **Isi BREAK** (menit istirahat, jika ada).
7. Pilih **PC-1** dan **PC-2**.
8. Klik **Simpan Laporan**.

Setelah laporan tersimpan, laporan tersebut otomatis muncul di tab **Laporan Produksi** halaman admin tanpa refresh manual.

**Validasi yang berlaku:**
- QTY tidak boleh 0
- QTY NG tidak boleh melebihi QTY
- Kategori NG wajib dipilih jika NG > 0

### B. Tampilkan Dokumen ke TV Display

1. Navigasi ke folder dokumen yang sesuai.
2. Klik **Preview** (ikon mata) untuk melihat isi dokumen.
3. Klik **Tampilkan** (ikon monitor hijau) untuk mengirim dokumen ke layar TV Display lini ini secara realtime.
4. Kartu dokumen yang sedang aktif ditampilkan akan memiliki tanda khusus di tablet.

---

## 📺 4. TV Display

Layar TV Display diletakkan di area kerja setiap lini (stasiun kerja).

- Buka browser TV dengan URL: `http://[alamat-server]/display/[landId]`
- TV Display **tidak memerlukan login** dan bekerja sepenuhnya otomatis.
- Dokumen yang dikirim operator akan tampil **dalam waktu < 1 detik** secara realtime.
- Jika operator mengganti dokumen, TV Display memperbarui tampilannya secara otomatis.

---

## 💡 Tips & Catatan

| Situasi | Solusi |
|---|---|
| Part number belum muncul | Minta admin tambah di Tab **Part Number** |
| Laporan baru belum muncul di admin | Tunggu beberapa detik, klik **Perbarui**, lalu cek koneksi Supabase Realtime |
| Kategori NG tidak ada | Minta admin tambah di Tab **Kategori NG** |
| Dokumen tidak muncul di operator | Cek visibilitas dokumen (ikon mata) di admin |
| TV Display tidak update | Refresh halaman TV Display, cek koneksi jaringan |
