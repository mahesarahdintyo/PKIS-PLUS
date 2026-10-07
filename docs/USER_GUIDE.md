# 📚 Panduan Pengguna (User Guide) — PKIS-PLUS

Aplikasi **Futaba PKIS (PKIS-PLUS)** dirancang untuk mendukung operasional lini produksi dengan empat peran utama: **Admin**, **Leader**, **Operator**, dan **TV Display**.

---

## 🔑 1. Login & Hak Akses Pengguna

Buka aplikasi di peramban web dan masukkan **username** / **email** serta **password**.

- **Admin** → Diarahkan ke dashboard utama `/admin` untuk manajemen lini, dokumen, part number, laporan produksi, dan sistem monitoring `/system`.
- **Leader** → Diarahkan ke dashboard pengawas untuk memantau status lini produksi, menerima panggilan Andon, dan merespons kendala lapangan.
- **Operator** → Diarahkan ke antarmuka tablet `/operator` untuk mengontrol dokumen display, mencatat laporan produksi, downtime, dan memicu panggilan Andon.
- **TV Display** → Langsung membuka tautan `/display/[lineId]` di browser TV tanpa perlu login (mode tayang otomatis).

### 📲 Instalasi Progressive Web App (PWA)

Aplikasi mendukung instalasi langsung sebagai PWA ke layar utama tablet atau ponsel:
- **Android / Chrome / Tablet**: Tekan tombol **"Install Aplikasi Futaba PKIS"** di bawah formulir login atau menu browser *Add to Home screen*.
- **iOS / iPad Safari**: Tekan tombol **Share ⎋** pada Safari → pilih **Add to Home Screen**.

---

## 👑 2. Panduan Administrator

Halaman Admin (`/admin`) menyediakan kontrol terpusat melalui tab navigasi:

### Tab A: Workspace (Manajemen Dokumen & Folder)
- **Pemilihan Lini (Line)**: Pilih lini produksi yang ingin dikelola (misal: **Line 500T**, **Line 800T**).
- **Pengelolaan Folder**: Buat folder hierarkis untuk mengelompokkan dokumen berdasarkan stasiun kerja, jenis proses, atau kategori.
- **Unggah Dokumen (Upload)**:
  - Klik **Upload Document** di sudut kanan atas.
  - Masukkan judul, deskripsi, pilih folder tujuan, dan tentukan berkas (PDF, JPG, PNG hingga 50MB).
  - Berkas fisik otomatis tersimpan di direktori server lokal `public/uploads/documents/`.
- **Inline Edit & Visibilitas**:
  - Klik ikon **Pensil** untuk mengganti judul atau nama file display secara langsung tanpa perlu re-upload.
  - Klik ikon **Mata Coret** untuk menyembunyikan dokumen dari tablet operator (berguna untuk dokumen draft/revisi).
- **Recycle Bin**: Dokumen yang dihapus dapat dipulihkan atau dibersihkan permanen melalui menu Tempat Sampah (`/admin/recycle-bin`).

### Tab B: Laporan Produksi & Log Aktivitas
- Pantau laporan harian yang diisi operator secara langsung (*realtime update* tanpa perlu refresh browser).
- Filter data berdasarkan lini, rentang tanggal, shift kerja, atau pencarian nama operator / part number.
- Ekspor data laporan kerja ke format **CSV** untuk analisis lanjutan.

### Tab C: Manajemen Part Number
- Tambah, ubah, atau nonaktifkan part number per lini/mesin.
- Setiap penambahan part number akan langsung tersinkron ke dropdown tablet operator melalui Socket.io.

### Tab D: Kategori Cacat (NG)
- Kelola master kategori cacat (contoh: *Dimensi*, *Permukaan*, *Material*, *Proses*).
- Pilihan ini otomatis muncul di formulir operator ketika jumlah NG diisi lebih dari 0.

### 🖥️ Halaman Monitoring Sistem (`/system`)
- **Status Koneksi Database**: Memverifikasi kesiapan PostgreSQL dan latensi query.
- **Status TV Display per Lini**: Memantau apakah layar TV di setiap lini sedang online atau offline berdasarkan sinyal *heartbeat* otomatis setiap 30 detik.
- **Status Penyimpanan**: Memeriksa ketersediaan folder upload berkas lokal.

---

## 📱 3. Panduan Operator (Tablet Lini)

Antarmuka operator dirancang khusus untuk layar sentuh tablet di area lini kerja:

### A. Kontrol Dokumen TV Display
1. Pilih lini kerja Anda (misal: Line 500T).
2. Masuk ke folder dokumen yang diinginkan.
3. Klik tombol **Preview** untuk membaca dokumen di layar tablet.
4. Klik tombol **Tampilkan** (ikon monitor hijau) untuk menayangkan dokumen tersebut ke TV Display lini.
5. TV Display di lini Anda akan berganti menampilkan dokumen tersebut dalam hitungan milidetik secara realtime.

### B. Input Laporan Produksi & Downtime
1. **Pilih Part Number** dari daftar dropdown.
2. Waktu mulai akan tercatat otomatis.
3. Setelah sesi kerja selesai, tekan **Finish** untuk mencatat jam selesai.
4. Masukkan jumlah **QTY OK** (wajib > 0).
5. Masukkan jumlah **NG** jika terdapat produk cacat:
   - Tombol **Kategori NG** akan muncul secara otomatis.
   - Pilih kategori cacat yang sesuai.
6. Masukkan durasi **Break** (istirahat) jika ada.
7. Tekan **Simpan Laporan** — data langsung tersimpan ke database lokal dan muncul di dashboard pengawas.

### C. Panggilan Bantuan (Andon Call)
- Jika mesin mengalami kendala atau butuh bantuan Leader/QC/Maintenance:
  - Tekan tombol **Andon Call**.
  - Pilih alasan kendala (misal: *Mesin Rusak*, *Dies Problem*, *Material Habis*).
  - Panggilan akan disiarkan seketika ke dashboard Leader dan TV Display.

---

## 📺 4. Panduan TV Display Lini

Layar TV Display dipasang permanen di atas lini produksi:

- Cukup buka browser TV dengan alamat URL:
  ```
  http://[ip-server-pabrik]:3000/display/[lineId]
  ```
  *(Contoh: `http://192.168.1.100:3000/display/500T`)*
- Layar **tidak memerlukan login** atau interaksi fisik.
- Mengirim sinyal *heartbeat* otomatis ke server setiap 30 detik.
- Saat operator menekan tombol **Tampilkan** pada tablet, layar TV akan langsung memuat dan menampilkan dokumen kerja (PDF/Gambar) yang dipilih dalam resolusi optimal.

---

## 💡 Troubleshooting & FAQ

| Masalah | Kemungkinan Penyebab | Tindakan Solusi |
|---|---|---|
| TV Display tidak merespons perubahan dokumen | Koneksi jaringan terputus atau Socket.io disconnected | Muat ulang (*refresh*) halaman TV Display, periksa kabel LAN/WiFi TV. |
| Part Number baru tidak muncul di dropdown tablet | Belum diinput oleh admin atau koneksi socket offline | Hubungi Admin untuk memastikan part number aktif di tab Part Number, atau refresh halaman. |
| Gagal mengunggah dokumen | Format berkas tidak didukung atau ukuran melebihi 50MB | Pastikan file berformat PDF, JPG, atau PNG dengan ukuran di bawah 50MB. |
| Status TV Display di `/system` bertuliskan Offline | TV belum membuka URL `/display/[lineId]` atau sinyal heartbeat terhenti | Pastikan browser TV tetap membuka halaman display dan tidak masuk ke mode sleep. |
