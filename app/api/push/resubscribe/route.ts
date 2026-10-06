import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Payload request tidak valid" },
        { status: 400 }
      );
    }

    const { oldEndpoint, subscription } = body;

    if (!oldEndpoint || typeof oldEndpoint !== "string") {
      return NextResponse.json(
        { error: "oldEndpoint wajib diisi" },
        { status: 400 }
      );
    }

    if (
      !subscription ||
      typeof subscription !== "object" ||
      !subscription.endpoint ||
      typeof subscription.endpoint !== "string" ||
      !subscription.keys ||
      typeof subscription.keys !== "object" ||
      !subscription.keys.p256dh ||
      !subscription.keys.auth
    ) {
      return NextResponse.json(
        { error: "Payload subscription tidak lengkap (endpoint, keys.p256dh, keys.auth wajib ada)" },
        { status: 400 }
      );
    }

    // 1. Cek apakah oldEndpoint ditemukan di tabel push_subscriptions
    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint: oldEndpoint },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Subscription lama tidak ditemukan" },
        { status: 404 }
      );
    }

    // 2. Update baris push_subscriptions yang endpoint-nya = oldEndpoint
    await prisma.pushSubscription.updateMany({
      where: { endpoint: oldEndpoint },
      data: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      },
    });

    return NextResponse.json(
      { success: true, message: "Subscription berhasil diperbarui" },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Fatal error di POST /api/push/resubscribe:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
