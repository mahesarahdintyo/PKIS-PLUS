# 🚀 Panduan Deployment Produksi (Self-Hosted / VPS / On-Premise)

Dokumen ini memandu proses deployment **Futaba PKIS (PKIS-PLUS)** ke lingkungan produksi.

Karena sistem ini menggunakan **WebSocket persisten via Socket.io** dan **penyimpanan file lokal (`public/uploads`)**, aplikasi ini dirancang untuk dijalankan di server mandiri (*VPS Linux, Server Fisik On-Premise Pabrik, atau Windows Server*) menggunakan **Node.js + PM2 + PostgreSQL + Nginx**.

---

## 🏗️ Arsitektur Produksi

```
[ Klien / Tablet / TV Display / Browser ]
                     │  (HTTP & WebSocket /api/socket)
                     ▼
         [ Nginx Reverse Proxy ]
                     │  Port 80/443 -> Port 3000
                     ▼
       [ PM2 Node.js Process Manager ]
            (node server.js)
          Next.js + Socket.io
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
[ PostgreSQL Lokal ]    [ Storage Direktori ]
   (Port 5432)          (./public/uploads/)
```

---

## 📋 Prasyarat Server Produksi

- **OS**: Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022
- **Node.js**: v18 LTS atau v20 LTS
- **PostgreSQL**: v14 atau lebih baru
- **PM2**: Process manager global (`npm install -g pm2`)
- **Nginx**: Web server & reverse proxy

---

## 🛠️ Langkah-Langkah Deployment

### 1. Siapkan Database PostgreSQL Produksi

Login ke PostgreSQL dan buat user serta database khusus produksi:

```sql
CREATE DATABASE pkis_plus;
CREATE USER pkis_user WITH ENCRYPTED PASSWORD 'password_produksi_yang_sangat_kuat';
GRANT ALL PRIVILEGES ON DATABASE pkis_plus TO pkis_user;
```

---

### 2. Unduh Source Code & Install Dependencies

```bash
git clone https://github.com/mahesarahdintyo/PKIS-PLUS.git /var/www/pkis-plus
cd /var/www/pkis-plus
npm install --omit=dev
```

---

### 3. Konfigurasi Environment Variables (`.env`)

Buat file `.env` di root direktori `/var/www/pkis-plus/`:

```env
# Database
DATABASE_URL="postgresql://pkis_user:password_produksi_yang_sangat_kuat@localhost:5432/pkis_plus?schema=public"

# Keamanan Password Salt (Ganti dengan string rahasia yang acak dan panjang)
PASSWORD_SALT="prod_pkis_futaba_salt_9847120391823091823"

# Server
NODE_ENV=production
PORT=3000
HOST="127.0.0.1"

# Upload Storage (Gunakan absolute path atau relative path)
UPLOAD_DIR="./public/uploads"
NEXT_PUBLIC_STORAGE_URL="/uploads"

# Polling Fallback
NEXT_PUBLIC_ENABLE_AUTO_POLLING=true

# Web Push VAPID (Opsional untuk modul Andon Call)
VAPID_PUBLIC_KEY="BCPEeRkRPz2P0UQKWiu1X3nAjZ5C3UrVG4In4KJXw8Z9TGJhHlRxCzxbqPekSEU7M_nOsoitqZr9Ry7Q0bFeNAw"
VAPID_PRIVATE_KEY="isi_dengan_private_key_jika_menggunakan_push"
VAPID_SUBJECT="mailto:it-admin@futaba.co.id"
```

---

### 4. Terapkan Skema Database & Data Awal

Jalankan generator client Prisma, terapkan struktur tabel, dan jalankan seeder awal:

```bash
# Generate client
npx prisma generate

# Sinkronkan skema tabel ke database produksi
npx prisma db push

# (Opsional) Isi user awal (Admin, Operator, Leader) dan kategori dasar
node prisma/seed.js
```

---

### 5. Kompilasi Aplikasi (Production Build)

Kompilasi source code TypeScript & Next.js:

```bash
npm run build
```
*Pastikan proses build selesai dengan exit code 0 (`Compiled successfully`).*

---

### 6. Menjalankan Aplikasi dengan PM2

Jalankan custom server (`server.js`) menggunakan PM2 agar aplikasi otomatis berjalan di background dan otomatis me-restart jika server reboot:

```bash
# Jalankan server.js dalam mode produksi
pm2 start server.js --name "pkis-plus" --env NODE_ENV=production

# Simpan konfigurasi agar auto-start saat reboot OS
pm2 save
pm2 startup
```

Perintah pemantauan PM2 yang berguna:
```bash
pm2 status          # Cek status proses
pm2 logs pkis-plus   # Pantau realtime logs aplikasi & socket.io
pm2 restart pkis-plus # Restart aplikasi setelah update kode
```

---

### 7. Konfigurasi Nginx Reverse Proxy (Termasuk WebSocket)

Buat file konfigurasi Nginx baru, misalnya `/etc/nginx/sites-available/pkis-plus`:

```nginx
server {
    listen 80;
    server_name pkis.futaba.local 192.168.1.100; # Sesuaikan domain / IP pabrik

    # Batas ukuran upload (sesuaikan dengan dokumen PDF drawing, misal 100MB)
    client_max_body_size 100M;

    # Static uploads caching & direct serving
    location /uploads/ {
        alias /var/www/pkis-plus/public/uploads/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # WebSocket Socket.io endpoint
    location /api/socket {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Next.js App routes
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan konfigurasi dan reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/pkis-plus /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 💾 Strategi Backup Data

### 1. Backup Database PostgreSQL
Buat cron job harian untuk mencadangkan database secara otomatis:
```bash
# Contoh skrip backup harian
pg_dump -U pkis_user -h localhost pkis_plus | gzip > /backup/pkis_db_$(date +%Y%m%d).sql.gz
```

### 2. Backup Direktori Upload
Pastikan folder `/var/www/pkis-plus/public/uploads/` disertakan dalam backup berkala server (misal dengan rsync ke server backup atau NAS).

---

## 🔄 Prosedur Pembaruan Aplikasi (Update Code)

Saat ada pembaruan kode dari repositori Git:

```bash
cd /var/www/pkis-plus
git pull origin main
npm install --omit=dev
npx prisma generate
npx prisma db push # Jika ada perubahan skema database
npm run build
pm2 restart pkis-plus
```

---

## 📋 Checklist Sebelum Go-Live

- [ ] Variabel `DATABASE_URL` dan `PASSWORD_SALT` sudah diset dengan nilai aman produksi
- [ ] Database PostgreSQL aktif dan skema Prisma sudah tersinkronkan (`db push`)
- [ ] User admin utama sudah diganti passwordnya dari password bawaan seeder
- [ ] Folder `public/uploads/documents/` memiliki izin tulis (*write permission*) untuk user runtime Node.js
- [ ] Socket.io terhubung tanpa kendala via Nginx (`/api/socket`)
- [ ] TV Display di tiap lini dapat membuka URL `/display/[lineId]` dan menerima update dokumen
- [ ] Service PM2 sudah di-save dan di-enable pada boot sistem (`pm2 startup`)
- [ ] Skrip backup otomatis PostgreSQL sudah dikonfigurasi
