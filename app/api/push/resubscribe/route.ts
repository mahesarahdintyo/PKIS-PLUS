import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";

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

    const supabase = createAdminClient();

    // 1. Cek apakah oldEndpoint ditemukan di tabel push_subscriptions
    const { data: existing, error: findError } = await supabase
      .from("push_subscriptions" as any)
      .select("id")
      .eq("endpoint", oldEndpoint)
      .maybeSingle();

    if (findError) {
      console.error("Error mencari push_subscriptions lama:", findError);
      return NextResponse.json(
        { error: "Terjadi kesalahan internal database" },
        { status: 500 }
      );
    }

    // Kalau oldEndpoint tidak ditemukan, balas 404 tanpa membuat baris baru
    if (!existing) {
      return NextResponse.json(
        { error: "Subscription lama tidak ditemukan" },
        { status: 404 }
      );
    }

    // 2. Update baris push_subscriptions yang endpoint-nya = oldEndpoint
    const { error: updateError } = await supabase
      .from("push_subscriptions" as any)
      .update({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
      })
      .eq("endpoint", oldEndpoint);

    if (updateError) {
      console.error("Gagal mengupdate push_subscriptions:", updateError);
      return NextResponse.json(
        { error: "Gagal memperbarui subscription: " + updateError.message },
        { status: 500 }
      );
    }

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
