// app/api/produksi/downtime/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesin = searchParams.get("mesin");
    const kategori = searchParams.get("kategori");
    const lineId = searchParams.get("line_id");
    const startDate = searchParams.get("startDate") || searchParams.get("dari");
    const endDate = searchParams.get("endDate") || searchParams.get("sampai");
    const pStart = searchParams.get("pStart");
    const pEnd = searchParams.get("pEnd");
    const limit = parseInt(searchParams.get("limit") || "1000", 10);
    const page = parseInt(searchParams.get("page") || "0", 10);
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") where.is_active = isActive;
    if (mesin && mesin !== "all") where.mesin = mesin;
    if (kategori && kategori !== "all") where.kategori = kategori;
    if (lineId && lineId !== "all") where.line_id = lineId;

    if (pStart || pEnd) {
      where.waktu_awal = {};
      if (pStart) where.waktu_awal.gte = new Date(pStart);
      if (pEnd) where.waktu_awal.lt = new Date(pEnd);
    } else if (startDate || endDate) {
      where.waktu_awal = {};
      if (startDate) where.waktu_awal.gte = new Date(`${startDate}T00:00:00`);
      if (endDate) where.waktu_awal.lte = new Date(`${endDate}T23:59:59`);
    }

    const data = await prisma.prodDowntimeLog.findMany({
      where,
      orderBy: { waktu_awal: "desc" },
      take: limit,
      skip: page * limit,
    });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/downtime]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = body.data || body;

    const res = await prisma.prodDowntimeLog.create({
      data: {
        mesin: data.mesin,
        line_id: data.line_id ?? null,
        waktu_awal: data.waktu_awal ? new Date(data.waktu_awal) : (data.start_time ? new Date(data.start_time) : new Date()),
        waktu_akhir: data.waktu_akhir ? new Date(data.waktu_akhir) : (data.end_time ? new Date(data.end_time) : new Date()),
        kategori: data.kategori ?? null,
        problem: data.problem ?? null,
        penyebab: data.penyebab ?? null,
        countermeasure: data.countermeasure ?? null,
        stasiun: data.stasiun ?? null,
        production_log_id: data.production_log_id ?? null,
        is_active: data.is_active !== undefined ? data.is_active : true,
        created_by: data.created_by ?? null,
        updated_by: data.updated_by ?? null,
      },
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/downtime]", e);
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
    // Normalize field names from client (might send start_time/end_time or waktu_awal/waktu_akhir)
    if (cleanData.start_time) { cleanData.waktu_awal = new Date(cleanData.start_time); delete cleanData.start_time; }
    if (cleanData.end_time) { cleanData.waktu_akhir = new Date(cleanData.end_time); delete cleanData.end_time; }
    if (cleanData.waktu_awal) cleanData.waktu_awal = new Date(cleanData.waktu_awal);
    if (cleanData.waktu_akhir) cleanData.waktu_akhir = new Date(cleanData.waktu_akhir);

    if (ids && ids.length > 0) {
      const res = await prisma.prodDowntimeLog.updateMany({
        where: { id: { in: ids } },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    const res = await prisma.prodDowntimeLog.update({
      where: { id },
      data: cleanData,
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/downtime]", e);
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

    const res = await prisma.prodDowntimeLog.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ data: res, count: res.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/downtime]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
