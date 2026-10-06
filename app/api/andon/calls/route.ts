// app/api/andon/calls/route.ts
// GET: daftar panggilan andon (aktif / semua / paginasi)
// POST: buat panggilan baru
// PATCH: update panggilan (status, alasan, mesin, dsb.)
// DELETE: hapus panggilan (single id atau bulk ids)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusIn = searchParams.getAll("status");
    const statusSingle = searchParams.get("status_single");
    const mesin = searchParams.get("mesin");
    const lineId = searchParams.get("line_id");
    const limitStr = searchParams.get("limit");
    const pageStr = searchParams.get("page");
    const offsetStr = searchParams.get("offset");

    const limit = limitStr ? parseInt(limitStr, 10) : 200;
    const page = pageStr ? parseInt(pageStr, 10) : 0;
    const skip = offsetStr ? parseInt(offsetStr, 10) : page * limit;

    const where: any = {};
    if (statusIn.length > 0) where.status = { in: statusIn };
    else if (statusSingle && statusSingle !== "all") where.status = statusSingle;

    if (mesin && mesin !== "all") where.mesin = mesin;
    if (lineId && lineId !== "all") {
      where.OR = [{ line_id: lineId }, { mesin: mesin || undefined }].filter(Boolean);
    }

    const calls = await prisma.andonCall.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      skip,
    });

    return NextResponse.json({ data: calls, error: null });
  } catch (e: any) {
    console.error("[GET /api/andon/calls]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { line_id, line_name, mesin, stasiun, alasan, triggered_by, status } = body;

    if (!mesin) {
      return NextResponse.json({ data: null, error: "mesin wajib diisi" }, { status: 400 });
    }

    const call = await prisma.andonCall.create({
      data: {
        line_id: line_id ?? null,
        line_name: line_name ?? null,
        mesin,
        stasiun: stasiun ?? null,
        alasan: alasan ?? null,
        triggered_by: triggered_by ?? null,
        status: status || "pending",
      },
    });

    return NextResponse.json({ data: call, error: null });
  } catch (e: any) {
    console.error("[POST /api/andon/calls]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, acknowledged_by, acknowledged_at, mesin, line_name, line_id, stasiun, alasan } = body;

    if (!id) {
      return NextResponse.json({ data: null, error: "id wajib diisi" }, { status: 400 });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (acknowledged_by !== undefined) updateData.acknowledged_by = acknowledged_by;
    if (acknowledged_at !== undefined) updateData.acknowledged_at = acknowledged_at ? new Date(acknowledged_at) : null;
    if (mesin !== undefined) updateData.mesin = mesin;
    if (line_name !== undefined) updateData.line_name = line_name;
    if (line_id !== undefined) updateData.line_id = line_id;
    if (stasiun !== undefined) updateData.stasiun = stasiun;
    if (alasan !== undefined) updateData.alasan = alasan;

    const updated = await prisma.andonCall.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/andon/calls]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const id = body.id || searchParams.get("id");
    const ids = body.ids || (id ? [id] : []);

    if (!ids || ids.length === 0) {
      return NextResponse.json({ data: null, error: "id atau ids wajib diisi" }, { status: 400 });
    }

    const deleted = await prisma.andonCall.deleteMany({
      where: { id: { in: ids } },
    });

    return NextResponse.json({ data: deleted, count: deleted.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/andon/calls]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
