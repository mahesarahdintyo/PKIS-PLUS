// app/api/andon/leaders/route.ts
// GET: daftar leader (filter by user_id)
// POST/PATCH: upsert leader
// DELETE: nonaktifkan leader

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const mesin = searchParams.get("mesin");
    const isActive = searchParams.get("is_active");

    const where: any = {};
    if (userId) where.user_id = userId;
    if (mesin) where.mesin = mesin;
    if (isActive !== null) where.is_active = isActive === "true";

    const leaders = await prisma.andonLeader.findMany({
      where,
      orderBy: { mesin: "asc" },
    });

    return NextResponse.json({ data: leaders, error: null });
  } catch (e: any) {
    console.error("[GET /api/andon/leaders]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, mesin, tier } = body;

    if (!user_id || !mesin || !tier) {
      return NextResponse.json({ data: null, error: "user_id, mesin, dan tier wajib diisi" }, { status: 400 });
    }

    // Upsert: aktifkan kembali jika sebelumnya is_active=false
    const leader = await prisma.andonLeader.upsert({
      where: { user_id_mesin_tier: { user_id, mesin, tier } },
      create: { user_id, mesin, tier, is_active: true },
      update: { is_active: true },
    });

    return NextResponse.json({ data: leader, error: null });
  } catch (e: any) {
    console.error("[POST /api/andon/leaders]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json({ data: null, error: "id wajib diisi" }, { status: 400 });
    }

    const updated = await prisma.andonLeader.update({
      where: { id },
      data: { is_active: is_active ?? false },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/andon/leaders]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
