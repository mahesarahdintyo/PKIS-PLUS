// app/api/produksi/safety/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kategori = searchParams.get("kategori");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "60", 10);
    const page = parseInt(searchParams.get("page") || "0", 10);
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") where.is_active = isActive;
    if (kategori && kategori !== "all") where.kategori = kategori;

    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = new Date(startDate);
      if (endDate) where.tanggal.lte = new Date(endDate);
    }

    const data = await prisma.prodSafetyLog.findMany({
      where,
      orderBy: { tanggal: "desc" },
      take: limit,
      skip: page * limit,
    });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/safety]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = body.data || body;

    const res = await prisma.prodSafetyLog.create({
      data: {
        tanggal: new Date(data.tanggal),
        kategori: data.kategori || "ACCIDENT",
        keterangan: data.keterangan ?? null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      },
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/safety]", e);
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

    const cleanData = { ...data };
    if (cleanData.tanggal) cleanData.tanggal = new Date(cleanData.tanggal);

    if (ids && ids.length > 0) {
      const res = await prisma.prodSafetyLog.updateMany({
        where: { id: { in: ids } },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    const res = await prisma.prodSafetyLog.update({
      where: { id },
      data: cleanData,
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/safety]", e);
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

    const res = await prisma.prodSafetyLog.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ data: res, count: res.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/safety]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
