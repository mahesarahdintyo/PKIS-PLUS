// =========================================================
// Service Worker — bikin app bisa di-"install" ke homescreen HP
// + cache tampilan (shell) supaya buka app tetap cepat walau
// sinyal di lapangan lemah. Data tetap butuh koneksi (via Supabase),
// ini cuma men-cache HTML/CSS/JS-nya, bukan data produksi.
// =========================================================
const CACHE_NAME = "produksi-downtime-shell-v2";

const SHELL_FILES = [
  "/",
  "/login",
  "/input-attendance",
  "/input-produksi",
  "/input-safety",
  "/input-scrap",
  "/icons/emoji-3d/safety.png",
  "/icons/emoji-3d/target.png",
  "/icons/emoji-3d/gear.png",
  "/icons/emoji-3d/money-bag.png",
  "/icons/emoji-3d/people.png",
  "/icons/emoji-3d/dashboard.png",
  "/icons/emoji-3d/chart-up.png",
  "/icons/emoji-3d/scrap.png",
  "/icons/emoji-3d/recycle.png",
  "/icons/emoji-3d/clipboard.png",
  "/icons/emoji-3d/alert-light.png",
  "/icons/emoji-3d/bell.png",
  "/icons/emoji-3d/factory.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // pakai allSettled supaya 1 file gagal tidak gagalkan semua
      Promise.allSettled(SHELL_FILES.map((f) => cache.add(f)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategi: network-first untuk semua GET same-origin (supaya selalu dapat
// versi terbaru kalau online), fallback ke cache kalau offline. Untuk request
// ke Supabase (data produksi/downtime) atau domain lain TIDAK di-cache — harus
// selalu langsung ke server.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// =========================================================
// ANDON: notifikasi push "Panggil Leader" -- dering + getar,
// sekalipun app-nya sedang tertutup.
// =========================================================
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || "🔔 Panggilan Andon";
  const options = {
    body: data.body || "Operator memanggil leader",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: data.tier === 2 ? [400, 150, 400, 150, 400, 150, 400] : [400, 150, 400, 150, 400],
    tag: "andon-" + (data.call_id || "umum"), // notif baru gantikan yg lama utk call yg sama, tidak numpuk
    renotify: true,
    requireInteraction: true, // notif tetap nangkring sampai ditekan, tidak hilang sendiri
    data: { call_id: data.call_id, mesin: data.mesin },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = "/?andon=" + encodeURIComponent(event.notification.data?.call_id || "");

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "ANDON_NOTIFICATION_CLICK", call_id: event.notification.data?.call_id });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
