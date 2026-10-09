// app/api/push/send-andon/route.ts
// Handler pengganti Supabase Edge Function 'send-andon-push'

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastAndonEvent } from "@/lib/socket";
import { getFirebaseMessaging } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const { call_id, tier = 1 } = await request.json();

    if (!call_id) {
      return NextResponse.json({ error: "call_id wajib diisi" }, { status: 400 });
    }

    // Ambil data panggilan Andon
    const call = await prisma.andonCall.findUnique({
      where: { id: call_id },
    });

    if (!call) {
      return NextResponse.json({ error: "panggilan tidak ditemukan" }, { status: 404 });
    }

    // Broadcast ke Socket.io realtime
    broadcastAndonEvent("call:created", {
      ...call,
      tier,
    });

    // Cari leader terdaftar untuk mesin ini pada tier bersangkutan
    const leaders = await prisma.andonLeader.findMany({
      where: {
        mesin: call.mesin,
        tier: Number(tier),
      },
      select: { user_id: true },
    });

    const userIds = leaders.map((l) => l.user_id);

    if (userIds.length === 0) {
      return NextResponse.json({
        sent: 0,
        note: `Belum ada leader tier ${tier} terdaftar untuk ${call.mesin}`,
      });
    }

    // Ambil SEMUA push subscriptions leader (Web Push maupun FCM)
    const subs = await prisma.pushSubscription.findMany({
      where: {
        user_id: { in: userIds },
      },
    });

    // Pisahkan berdasarkan type
    const webSubs = subs.filter((s) => s.type === "WEB" && s.endpoint);
    const fcmSubs = subs.filter((s) => s.type === "FCM" && s.fcm_token);

    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    let sent = 0;
    let failed = 0;

    const lineDisplayName = call.line_name || call.mesin;

    // ─── Blok 1: Web Push (Browser) ─────────────────────────────────────────
    if (vapidPublic && vapidPrivate && webSubs.length > 0) {
      try {
        // @ts-ignore
        const webpush = await import("web-push");
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:admin@localhost",
          vapidPublic,
          vapidPrivate
        );

        const payload = JSON.stringify({
          title:
            tier === 2
              ? `🚨 ESKALASI Andon - ${lineDisplayName}`
              : `🔔 Panggilan Andon - ${lineDisplayName}`,
          body: call.alasan ? `Alasan: ${call.alasan}` : "Operator memanggil leader",
          call_id: call.id,
          mesin: call.mesin,
          line_id: call.line_id || null,
          line_name: call.line_name || null,
          tier,
        });

        for (const sub of webSubs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth_key,
                },
              },
              payload,
              { urgency: "high", TTL: 120 }
            );
            sent++;
          } catch (err: any) {
            failed++;
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              // Subscription sudah tidak valid — hapus dari database
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn("[WebPush optional warning]:", err);
      }
    }

    // ─── Blok 2: FCM Push (Android Native) ──────────────────────────────────
    if (fcmSubs.length > 0) {
      const messaging = getFirebaseMessaging();

      if (!messaging) {
        console.warn(
          "[FCM] FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi di .env — " +
          `${fcmSubs.length} perangkat Android dilewati.`
        );
      } else {
        const andonTitle =
          tier === 2
            ? `🚨 ESKALASI Andon - ${lineDisplayName}`
            : `🔔 Panggilan Andon - ${lineDisplayName}`;

        for (const sub of fcmSubs) {
          if (!sub.fcm_token) continue;

          try {
            await messaging.send({
              token: sub.fcm_token,
              // Gunakan 'data' (bukan 'notification') agar Android bisa handle
              // notifikasi sendiri di background/foreground secara konsisten.
              data: {
                action: "andon_alert",
                call_id: call.id,
                mesin: call.mesin,
                line_id: call.line_id ?? "",
                line_name: call.line_name ?? call.mesin,
                alasan: call.alasan ?? "",
                title: andonTitle,
                body: call.alasan
                  ? `Alasan: ${call.alasan}`
                  : "Operator memanggil leader",
                tier: String(tier),
              },
              android: {
                priority: "high",
                ttl: 120 * 1000, // 2 menit dalam milliseconds
              },
            });
            sent++;
          } catch (err: any) {
            failed++;
            const errCode = err?.errorInfo?.code ?? "";
            // Token expired / unregistered → hapus dari database
            if (
              errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered"
            ) {
              await prisma.pushSubscription
                .delete({ where: { id: sub.id } })
                .catch(() => {});
              console.log(`[FCM] Token kadaluarsa dihapus: ${sub.id}`);
            } else {
              console.error(`[FCM] Gagal kirim ke ${sub.id}:`, errCode, err?.message);
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      subscribersCount: subs.length,
      webCount: webSubs.length,
      fcmCount: fcmSubs.length,
      realtimeBroadcast: true,
    });
  } catch (error: any) {
    console.error("[Send Andon Push Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
