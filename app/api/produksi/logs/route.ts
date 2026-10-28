// app/api/produksi/logs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseDateParam(val: string | null | undefined, isEnd = false): Date | null {
  if (!val || val === "undefined" || val === "null") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // Jika string sudah mengandung 'T' atau spasi (ISO atau datetime)
  if (trimmed.includes("T") || trimmed.includes(" ")) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // Jika format hanya YYYY-MM-DD (gunakan timezone WIB +07:00 agar mencakup 1 hari penuh)
  const suffix = isEnd ? "T23:59:59.999+07:00" : "T00:00:00.000+07:00";
  const d = new Date(`${trimmed}${suffix}`);
  if (!isNaN(d.getTime())) return d;

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

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
    const limitParam = searchParams.get("limit");
    let take: number | undefined = undefined;
    if (limitParam && limitParam !== "all" && limitParam !== "none") {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        take = parsed;
      }
    }
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const buildWhere = () => {
      const where: any = {};
      if (isActiveStr !== "all") where.is_active = isActive;
      if (mesin && mesin !== "all") where.mesin = mesin;
      if (lineId && lineId !== "all") where.line_id = lineId;

      if (pStart || pEnd) {
        const gte = parseDateParam(pStart, false);
        const lt = parseDateParam(pEnd, true);
        if (gte || lt) {
          where.waktu_awal = {};
          if (gte) where.waktu_awal.gte = gte;
          if (lt) where.waktu_awal.lt = lt;
        }
      } else if (startDate || endDate) {
        const gte = parseDateParam(startDate, false);
        const lte = parseDateParam(endDate, true);
        if (gte || lte) {
          where.waktu_awal = {};
          if (gte) where.waktu_awal.gte = gte;
          if (lte) where.waktu_awal.lte = lte;
        }
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
        ...(take ? { take } : {}),
      });
      const data = await attachLineNames(raw);
      return NextResponse.json({ data, error: null });
    }

    if (table === "dandori") {
      const raw = await prisma.prodDandoriLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        ...(take ? { take } : {}),
      });
      const data = await attachLineNames(raw);
      return NextResponse.json({ data, error: null });
    }

    // Both
    const [rawProd, rawDandori] = await Promise.all([
      prisma.prodProductionLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        ...(take ? { take } : {}),
      }),
      prisma.prodDandoriLog.findMany({
        where: buildWhere(),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        ...(take ? { take } : {}),
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
