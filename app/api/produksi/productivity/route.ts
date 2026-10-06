// app/api/produksi/productivity/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "90", 10);
    const page = parseInt(searchParams.get("page") || "0", 10);
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") where.is_active = isActive;

    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = new Date(startDate);
      if (endDate) where.tanggal.lte = new Date(endDate);
    }

    const data = await prisma.productivityDailyReference.findMany({
      where,
      orderBy: { tanggal: "desc" },
      take: limit,
      skip: page * limit,
    });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/productivity]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = body.data || body;
    const isUpsert = body.upsert === true;

    const tanggal = new Date(payload.tanggal);
    const eh_jam = Number(payload.eh_jam) || 0;
    const is_active = payload.is_active !== undefined ? payload.is_active : true;

    let res: any;
    if (isUpsert) {
      // Upsert keyed on tanggal (unique column)
      res = await prisma.productivityDailyReference.upsert({
        where: { tanggal },
        update: { eh_jam, is_active },
        create: { tanggal, eh_jam, is_active },
      });
    } else {
      res = await prisma.productivityDailyReference.create({
        data: { tanggal, eh_jam, is_active },
      });
    }

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/productivity]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ids, tanggal, data } = body;

    const cleanData = { ...data };
    if (cleanData.tanggal) cleanData.tanggal = new Date(cleanData.tanggal);
    if (cleanData.eh_jam !== undefined) cleanData.eh_jam = Number(cleanData.eh_jam);

    // Bulk update by ids
    if (ids && ids.length > 0) {
      const res = await prisma.productivityDailyReference.updateMany({
        where: { id: { in: ids } },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    // Update by id
    if (id) {
      const res = await prisma.productivityDailyReference.update({
        where: { id },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    // Update by tanggal (fallback for records without uuid)
    if (tanggal) {
      const res = await prisma.productivityDailyReference.updateMany({
        where: { tanggal: new Date(tanggal) },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "id, ids, atau tanggal wajib diisi" }, { status: 400 });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/productivity]", e);
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

    const res = await prisma.productivityDailyReference.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ data: res, count: res.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/productivity]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
