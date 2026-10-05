// app/api/push/send-andon/route.ts
// Handler pengganti Supabase Edge Function 'send-andon-push'

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastAndonEvent } from "@/lib/socket";

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

    // Cari push subscriptions
    const subs = await prisma.pushSubscription.findMany({
      where: {
        user_id: { in: userIds },
      },
    });

    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    let sent = 0;
    let failed = 0;

    if (vapidPublic && vapidPrivate && subs.length > 0) {
      try {
        // @ts-ignore
        const webpush = await import("web-push");
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT || "mailto:admin@localhost",
          vapidPublic,
          vapidPrivate
        );

        const lineDisplayName = call.line_name || call.mesin;
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

        for (const sub of subs) {
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
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn("[WebPush optional warning]:", err);
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      subscribersCount: subs.length,
      realtimeBroadcast: true,
    });
  } catch (error: any) {
    console.error("[Send Andon Push Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
