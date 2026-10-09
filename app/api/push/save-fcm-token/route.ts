// app/api/push/save-fcm-token/route.ts
// Endpoint untuk menyimpan atau memperbarui FCM token dari perangkat Android Native.
// Dipanggil oleh JS Bridge (window.saveAndroidFcmToken) di dalam WebView Android.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Validasi session — harus login untuk bisa mendaftarkan token
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: sesi tidak valid atau sudah expired" },
        { status: 401 }
      );
    }

    // 2. Parsing body request
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Payload request tidak valid" },
        { status: 400 }
      );
    }

    const { fcmToken, deviceLabel } = body as {
      fcmToken?: string;
      deviceLabel?: string;
    };

    if (!fcmToken || typeof fcmToken !== "string" || fcmToken.trim() === "") {
      return NextResponse.json(
        { error: "fcmToken wajib diisi dan tidak boleh kosong" },
        { status: 400 }
      );
    }

    const cleanToken = fcmToken.trim();
    const userId = user.id;

    // 3. Upsert: update jika token sudah ada (milik user ini atau device yang sama),
    //    buat baru jika belum ada.
    //
    // Strategi:
    //   a. Cari apakah token ini sudah tersimpan untuk user yang sama → update device_label saja
    //   b. Jika token ini milik user lain (device berpindah tangan) → pindahkan ke user ini
    //   c. Jika belum ada → buat baru

    const existingByToken = await prisma.pushSubscription.findUnique({
      where: { fcm_token: cleanToken },
    });

    if (existingByToken) {
      // Token sudah terdaftar — update ke user saat ini & perbarui label
      await prisma.pushSubscription.update({
        where: { id: existingByToken.id },
        data: {
          user_id: userId,
          device_label: deviceLabel ?? existingByToken.device_label,
        },
      });

      return NextResponse.json(
        {
          success: true,
          action: "updated",
          message: "FCM token berhasil diperbarui",
        },
        { status: 200 }
      );
    }

    // Token baru — buat record FCM baru untuk user ini
    await prisma.pushSubscription.create({
      data: {
        user_id: userId,
        type: "FCM",
        fcm_token: cleanToken,
        device_label: deviceLabel ?? "Android Device",
        // endpoint, p256dh, auth_key sengaja tidak diisi (nullable untuk FCM)
      },
    });

    return NextResponse.json(
      {
        success: true,
        action: "created",
        message: "FCM token berhasil didaftarkan",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Save FCM Token Error]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
