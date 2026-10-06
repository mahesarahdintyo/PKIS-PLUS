// app/api/andon/push-subscriptions/route.ts
// POST: simpan/update push subscription

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, endpoint, p256dh, auth_key, device_label } = body;

    if (!user_id || !endpoint) {
      return NextResponse.json({ data: null, error: "user_id dan endpoint wajib diisi" }, { status: 400 });
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { user_id, endpoint, p256dh, auth_key, device_label },
      update: { user_id, p256dh, auth_key, device_label },
    });

    return NextResponse.json({ data: subscription, error: null });
  } catch (e: any) {
    console.error("[POST /api/andon/push-subscriptions]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
