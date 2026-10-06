// app/api/produksi/planning/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesin = searchParams.get("mesin");
    const lineId = searchParams.get("line_id");
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") where.is_active = isActive;
    if (mesin && mesin !== "all") where.mesin = mesin;
    if (lineId && lineId !== "all") where.line_id = lineId;

    const data = await prisma.prodProductionPlanning.findMany({
      where,
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/planning]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = Array.isArray(body) ? body[0] : (body.data || body);

    const now = new Date();
    // Support both legacy field names (tanggal/shift/target_qty) and new ones
    const jamMulai = data.jam_rencana_mulai
      ? new Date(data.jam_rencana_mulai)
      : (data.tanggal ? new Date(data.tanggal) : now);
    const jamSelesai = data.jam_rencana_selesai
      ? new Date(data.jam_rencana_selesai)
      : (data.tanggal ? new Date(new Date(data.tanggal).getTime() + 8 * 3600000) : new Date(now.getTime() + 8 * 3600000));

    const res = await prisma.prodProductionPlanning.create({
      data: {
        mesin: data.mesin,
        line_id: data.line_id ?? null,
        stasiun: data.stasiun ?? null,
        part_number: data.part_number,
        qty_rencana: data.qty_rencana !== undefined ? Number(data.qty_rencana) : (data.target_qty !== undefined ? Number(data.target_qty) : null),
        jam_rencana_mulai: jamMulai,
        jam_rencana_selesai: jamSelesai,
        status: data.status || "pending",
        actual_production_id: data.actual_production_id ?? null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_by: data.created_by ?? null,
        updated_by: data.updated_by ?? null,
      },
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/planning]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ids, data } = body;

    if (!id && (!ids || ids.length === 0)) {
      return NextResponse.json({ data: null, error: "id atau ids wajib diisi" }, { status: 400 });
    }

    const cleanData: any = { ...data };
    // Normalize legacy field names
    if (cleanData.tanggal) { cleanData.jam_rencana_mulai = new Date(cleanData.tanggal); delete cleanData.tanggal; }
    if (cleanData.jam_rencana_mulai) cleanData.jam_rencana_mulai = new Date(cleanData.jam_rencana_mulai);
    if (cleanData.jam_rencana_selesai) cleanData.jam_rencana_selesai = new Date(cleanData.jam_rencana_selesai);
    if (cleanData.target_qty !== undefined) { cleanData.qty_rencana = Number(cleanData.target_qty); delete cleanData.target_qty; }
    // Remove fields not in schema
    delete cleanData.shift;
    delete cleanData.urutan;

    if (ids && ids.length > 0) {
      const res = await prisma.prodProductionPlanning.updateMany({
        where: { id: { in: ids } },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    const res = await prisma.prodProductionPlanning.update({
      where: { id },
      data: cleanData,
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/planning]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const id = body.id || searchParams.get("id");
    const ids = body.ids || (id ? [id] : []);

    if (ids.length === 0) {
      return NextResponse.json({ data: null, error: "id atau ids wajib diisi" }, { status: 400 });
    }

    const res = await prisma.prodProductionPlanning.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ data: res, count: res.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/planning]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
