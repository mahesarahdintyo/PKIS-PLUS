// app/api/produksi/attendance/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shift = searchParams.get("shift");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "60", 10);
    const page = parseInt(searchParams.get("page") || "0", 10);
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") where.is_active = isActive;
    if (shift && shift !== "all") where.shift = shift;

    if (startDate || endDate) {
      where.tanggal = {};
      if (startDate) where.tanggal.gte = new Date(startDate);
      if (endDate) where.tanggal.lte = new Date(endDate);
    }

    const data = await prisma.prodAttendanceLog.findMany({
      where,
      orderBy: [{ tanggal: "desc" }, { shift: "asc" }],
      take: limit,
      skip: page * limit,
    });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/attendance]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = body.data || body;

    const hadir = Number(data.hadir ?? data.mp_hadir ?? 0);
    const absen = Number(data.absen ?? data.mp_absen ?? 0);
    const cuti = Number(data.cuti ?? 0);
    const total_orang = Number(data.total_orang ?? (hadir + absen + cuti));
    const overtime_jam = Number(data.overtime_jam ?? 0);

    const res = await prisma.prodAttendanceLog.create({
      data: {
        tanggal: new Date(data.tanggal),
        shift: String(data.shift || "1"),
        total_orang,
        hadir,
        absen,
        cuti,
        overtime_jam,
        is_active: data.is_active !== undefined ? data.is_active : true,
      },
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/attendance]", e);
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
    if (cleanData.tanggal) cleanData.tanggal = new Date(cleanData.tanggal);
    if (cleanData.shift !== undefined) cleanData.shift = String(cleanData.shift);
    if (cleanData.hadir !== undefined) cleanData.hadir = Number(cleanData.hadir);
    if (cleanData.absen !== undefined) cleanData.absen = Number(cleanData.absen);
    if (cleanData.cuti !== undefined) cleanData.cuti = Number(cleanData.cuti);
    if (cleanData.total_orang !== undefined) cleanData.total_orang = Number(cleanData.total_orang);
    if (cleanData.overtime_jam !== undefined) cleanData.overtime_jam = Number(cleanData.overtime_jam);
    delete cleanData.mp_hadir;
    delete cleanData.mp_absen;
    delete cleanData.keterangan_absen;

    if (ids && ids.length > 0) {
      const res = await prisma.prodAttendanceLog.updateMany({
        where: { id: { in: ids } },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    const res = await prisma.prodAttendanceLog.update({
      where: { id },
      data: cleanData,
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/attendance]", e);
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

    const res = await prisma.prodAttendanceLog.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ data: res, count: res.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/attendance]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
