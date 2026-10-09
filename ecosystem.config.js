// ecosystem.config.js
// ============================================================
// PM2 Ecosystem Configuration — PKIS-PLUS
// Jalankan dengan: pm2 start ecosystem.config.js
// ============================================================
//
// CATATAN PENTING:
// Aplikasi ini TIDAK menggunakan `next start` biasa, melainkan `node server.js`
// karena server.js menyatukan Next.js + Socket.io dalam satu proses.
// Menggunakan `next start` akan melewati Socket.io sehingga realtime tidak berfungsi.
//
// Cara penggunaan:
//   npm run build           # Build production bundle terlebih dahulu
//   pm2 start ecosystem.config.js   # Jalankan dengan PM2
//   pm2 save                         # Simpan config agar auto-start saat reboot
//   pm2 startup                      # Setup startup script OS

module.exports = {
  apps: [
    {
      // ─── Identitas Aplikasi ────────────────────────────────────────────────
      name: "pkis-plus",

      // ─── Entry Point ──────────────────────────────────────────────────────
      // Gunakan server.js (custom server) yang menggabungkan Next.js + Socket.io.
      // Argumen --dev TIDAK disertakan agar otomatis berjalan di mode production.
      script: "server.js",

      // ─── Lifecycle ────────────────────────────────────────────────────────
      instances: 1,        // Satu instance (Socket.io in-memory tidak support multi-instance tanpa adapter)
      autorestart: true,   // Restart otomatis jika crash
      watch: false,        // Nonaktifkan file watcher di production (gunakan pm2 restart manual)
      max_memory_restart: "512M", // Restart jika memory melebihi 512MB

      // ─── Environment Variables ────────────────────────────────────────────
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOST: "0.0.0.0",   // Binding ke semua interface → bisa diakses via IP LAN
      },

      // ─── Logging ──────────────────────────────────────────────────────────
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // ─── Graceful Restart ─────────────────────────────────────────────────
      kill_timeout: 5000,       // Tunggu 5 detik sebelum force-kill
      listen_timeout: 10000,    // Tunggu 10 detik hingga port ready
    },
  ],
};
