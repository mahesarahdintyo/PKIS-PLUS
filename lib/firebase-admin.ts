// lib/firebase-admin.ts
// Singleton initializer untuk Firebase Admin SDK (v12+ Modular API).
// Hanya dipakai di server-side (API Routes), TIDAK pernah di-import ke komponen client.
//
// Cara setup:
// 1. Buka Firebase Console → Project Settings → Service Accounts → Generate new private key
// 2. Download file JSON, lalu copy seluruh ISI-nya ke .env:
//    FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...",...}'
// Jika dikosongkan, FCM akan di-skip secara otomatis — tidak error.

import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let firebaseApp: App | null = null;

/**
 * Mengembalikan instance Firebase Admin App yang sudah terinisialisasi.
 * Singleton — aman dipanggil berkali-kali (termasuk saat Next.js hot-reload).
 * Mengembalikan null jika FIREBASE_SERVICE_ACCOUNT_JSON tidak di-set.
 */
export function getFirebaseAdmin(): App | null {
  // Jika instance sudah ada, return langsung
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson || serviceAccountJson.trim() === "" || serviceAccountJson === "''") {
    // FCM belum dikonfigurasi — ini wajar, fitur Android push hanya di-skip
    return null;
  }

  try {
    // Hindari double-init saat hot-reload development (getApps() mengembalikan app yang sudah ada)
    if (getApps().length > 0) {
      firebaseApp = getApp();
      return firebaseApp;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    console.log("[Firebase Admin] Initialized successfully.");
    return firebaseApp;
  } catch (err) {
    console.error("[Firebase Admin] Gagal menginisialisasi:", err);
    return null;
  }
}

/**
 * Mengembalikan Firebase Messaging instance.
 * Mengembalikan null jika FCM belum dikonfigurasi (FIREBASE_SERVICE_ACCOUNT_JSON kosong).
 */
export function getFirebaseMessaging(): Messaging | null {
  const app = getFirebaseAdmin();
  if (!app) return null;
  return getMessaging(app);
}
