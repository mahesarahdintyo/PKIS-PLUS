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
    const lineName = call.line_name || call.mesin || "";
    const title =
      tier === 2
        ? `🚨 ESKALASI Andon - ${lineDisplayName}`
        : `🔔 Panggilan Andon - ${lineDisplayName}`;
    const body = call.alasan ? `Alasan: ${call.alasan}` : "Operator memanggil leader";
    const category = (call as any).category || call.alasan || "ANDON";
    const creator = (call as any).triggered_by || "Operator";
    const targetLeader = userIds.join(", ");

    const validTokens = fcmSubs
      .map((s) => s.fcm_token)
      .filter((t): t is string => Boolean(t && t.trim().length > 0));

    // Ubah bagian message di app/api/push/send-andon/route.ts menjadi Data-Priority:
    const message = {
      // Hapus objek 'notification' di level root agar Android tidak memblokir onMessageReceived saat layar mati,
      // dan pindahkan semuanya ke dalam 'data':
      data: {
        title: title,
        body: body,
        url: "/operator",
        lineName: String(lineName || ""),
        category: String(category || ""),
        creator: String(creator || "Operator"),
        targetLeader: String(targetLeader || ""),
        timestamp: new Date().toISOString(),
        action: "andon_alert",
        call_id: String(call.id || ""),
        mesin: String(call.mesin || ""),
        line_id: String(call.line_id || ""),
        line_name: String(lineName || ""),
        alasan: String(call.alasan || ""),
        tier: String(tier),
      },
      android: {
        priority: "high" as const,
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          title,
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          vibrate: [300, 100, 300, 100, 400],
          requireInteraction: true,
          tag: "andon-alert-" + Date.now(),
        },
      },
      tokens: validTokens,
    };

    // ─── Blok 1: Web Push (Browser) ─────────────────────────────────────────
    if (vapidPublic && vapidPrivate && webSubs.length > 0) {
      try {
        const webpushModule = await import("web-push");
        const webpush = (webpushModule as any).default || webpushModule;
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:admin@localhost",
          vapidPublic,
          vapidPrivate
        );

        const payload = JSON.stringify({
          title,
          body,
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
    if (validTokens.length > 0) {
      const messaging = getFirebaseMessaging();

      if (!messaging) {
        console.warn(
          "[FCM] FIREBASE_SERVICE_ACCOUNT_JSON belum dikonfigurasi di .env — " +
          `${validTokens.length} perangkat Android dilewati.`
        );
      } else {
        try {
          const response = await messaging.sendEachForMulticast(message);
          sent += response.successCount;
          failed += response.failureCount;

          // Hapus token yang sudah kadaluarsa / unregistered
          if (response.failureCount > 0) {
            response.responses.forEach(async (resp, idx) => {
              if (!resp.success) {
                const errCode = resp.error?.code ?? "";
                if (
                  errCode === "messaging/invalid-registration-token" ||
                  errCode === "messaging/registration-token-not-registered"
                ) {
                  const badToken = validTokens[idx];
                  await prisma.pushSubscription
                    .deleteMany({ where: { fcm_token: badToken } })
                    .catch(() => {});
                  console.log(`[FCM] Token kadaluarsa dihapus: ${badToken}`);
                } else {
                  console.error(
                    `[FCM] Gagal kirim token index ${idx}:`,
                    errCode,
                    resp.error?.message
                  );
                }
              }
            });
          }
        } catch (fcmErr: any) {
          console.error("[FCM multicast error]:", fcmErr);
          failed += validTokens.length;
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
