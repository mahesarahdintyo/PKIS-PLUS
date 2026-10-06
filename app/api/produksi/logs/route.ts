// app/api/produksi/logs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table") || "both"; // "production" | "dandori" | "both"
    const mesin = searchParams.get("mesin");
    const lineId = searchParams.get("line_id");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const pStart = searchParams.get("pStart");
    const pEnd = searchParams.get("pEnd");
    const limit = parseInt(searchParams.get("limit") || "500", 10);
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const buildWhere = () => {
      const where: any = {};
      if (isActiveStr !== "all") where.is_active = isActive;
      if (mesin && mesin !== "all") where.mesin = mesin;
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
      return where;
    };

    const attachLineNames = async (rows: any[]) => {
      const lineIds = Array.from(new Set(rows.map((r: any) => r.line_id).filter(Boolean))) as string[];
      if (lineIds.length === 0) return rows;
      const lines = await prisma.line.findMany({
        where: { id: { in: lineIds } },
        select: { id: true, name: true },
      });
      const linesMap = Object.fromEntries(lines.map((l) => [l.id, l.name]));
      return rows.map((r) => ({
        ...r,
        line: r.line_id && linesMap[r.line_id] ? { name: linesMap[r.line_id] } : null,
      }));
    };

    if (table === "production") {
      const raw = await prisma.prodProductionLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: limit,
      });
      const data = await attachLineNames(raw);
      return NextResponse.json({ data, error: null });
    }

    if (table === "dandori") {
      const raw = await prisma.prodDandoriLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: limit,
      });
      const data = await attachLineNames(raw);
      return NextResponse.json({ data, error: null });
    }

    // Both
    const [rawProd, rawDandori] = await Promise.all([
      prisma.prodProductionLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: limit,
      }),
      prisma.prodDandoriLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: limit,
      }),
    ]);

    const [production, dandori] = await Promise.all([
      attachLineNames(rawProd),
      attachLineNames(rawDandori),
    ]);

    return NextResponse.json({
      data: { production, dandori },
      error: null,
    });
  } catch (e: any) {
    console.error("[GET /api/produksi/logs]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, data } = body;

    if (!table || !data) {
      return NextResponse.json({ data: null, error: "table dan data wajib diisi" }, { status: 400 });
    }

    if (table === "production" || table === "prod_production_log") {
      const res = await prisma.prodProductionLog.create({
        data: {
          ...data,
          waktu_awal: data.waktu_awal ? new Date(data.waktu_awal) : new Date(),
          waktu_akhir: data.waktu_akhir ? new Date(data.waktu_akhir) : null,
        },
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (table === "dandori" || table === "prod_dandori_log") {
      const res = await prisma.prodDandoriLog.create({
        data: {
          ...data,
          waktu_awal: data.waktu_awal ? new Date(data.waktu_awal) : new Date(),
          waktu_akhir: data.waktu_akhir ? new Date(data.waktu_akhir) : null,
        },
      });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "Tabel tidak dikenal" }, { status: 400 });
  } catch (e: any) {
    console.error("[POST /api/produksi/logs]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { table, id, ids, data } = body;

    if (!table || (!id && (!ids || ids.length === 0))) {
      return NextResponse.json({ data: null, error: "table dan id/ids wajib diisi" }, { status: 400 });
    }

    const cleanData = { ...data };
    if (cleanData.waktu_awal) cleanData.waktu_awal = new Date(cleanData.waktu_awal);
    if (cleanData.waktu_akhir) cleanData.waktu_akhir = new Date(cleanData.waktu_akhir);

    if (table === "production" || table === "prod_production_log") {
      if (ids && ids.length > 0) {
        const res = await prisma.prodProductionLog.updateMany({
          where: { id: { in: ids } },
          data: cleanData,
        });
        return NextResponse.json({ data: res, error: null });
      }
      const res = await prisma.prodProductionLog.update({
        where: { id },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (table === "dandori" || table === "prod_dandori_log") {
      if (ids && ids.length > 0) {
        const res = await prisma.prodDandoriLog.updateMany({
          where: { id: { in: ids } },
          data: cleanData,
        });
        return NextResponse.json({ data: res, error: null });
      }
      const res = await prisma.prodDandoriLog.update({
        where: { id },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "Tabel tidak dikenal" }, { status: 400 });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/logs]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const table = body.table || searchParams.get("table");
    const id = body.id || searchParams.get("id");
    const ids = body.ids || (id ? [id] : []);

    if (!table || ids.length === 0) {
      return NextResponse.json({ data: null, error: "table dan id/ids wajib diisi" }, { status: 400 });
    }

    if (table === "production" || table === "prod_production_log") {
      const res = await prisma.prodProductionLog.updateMany({
        where: { id: { in: ids } },
        data: { is_active: false },
      });
      return NextResponse.json({ data: res, count: res.count, error: null });
    }

    if (table === "dandori" || table === "prod_dandori_log") {
      const res = await prisma.prodDandoriLog.updateMany({
        where: { id: { in: ids } },
        data: { is_active: false },
      });
      return NextResponse.json({ data: res, count: res.count, error: null });
    }

    return NextResponse.json({ data: null, error: "Tabel tidak dikenal" }, { status: 400 });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/logs]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
