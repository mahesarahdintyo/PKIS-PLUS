// app/api/produksi/logs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCachedLines,
  buildLineFilterConditions,
  resolveLineInfo,
} from "@/lib/services/line-filter";

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
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const searchParam = searchParams.get("search");

    let take: number | undefined = undefined;
    if (limitParam && limitParam !== "all" && limitParam !== "none") {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        take = parsed;
      }
    }
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const allLines = await getCachedLines();
    const lineOrMesin =
      lineId && lineId !== "all" && lineId !== "undefined"
        ? lineId
        : mesin && mesin !== "all" && mesin !== "undefined"
        ? mesin
        : null;

    const lineFilterConds = buildLineFilterConditions(lineOrMesin, allLines);

    const buildWhere = (forTable: "production" | "dandori" = "production") => {
      const where: any = {};
      const andConditions: any[] = [];

      if (isActiveStr !== "all") where.is_active = isActive;

      if (lineFilterConds && lineFilterConds.length > 0) {
        andConditions.push({ OR: lineFilterConds });
      }

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

      if (searchParam && searchParam.trim()) {
        const q = searchParam.trim();
        if (forTable === "production") {
          andConditions.push({
            OR: [
              { part_number: { contains: q, mode: "insensitive" } },
              { kode: { contains: q, mode: "insensitive" } },
              { mesin: { contains: q, mode: "insensitive" } },
              { stasiun: { contains: q, mode: "insensitive" } },
            ],
          });
        } else {
          andConditions.push({
            OR: [
              { part_ke: { contains: q, mode: "insensitive" } },
              { part_dari: { contains: q, mode: "insensitive" } },
              { keterangan: { contains: q, mode: "insensitive" } },
              { mesin: { contains: q, mode: "insensitive" } },
            ],
          });
        }
      }

      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      return where;
    };

    const attachLineNames = (rows: any[]) => {
      return rows.map((r) => {
        const info = resolveLineInfo(r, allLines);
        return {
          ...r,
          line_id: info.line_id || r.line_id || null,
          line: { name: info.line_name },
        };
      });
    };

    if (pageParam !== null) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const pageSize = Math.max(1, parseInt(pageSizeParam || limitParam || "25", 10) || 25);
      const skip = (page - 1) * pageSize;

      if (table === "production") {
        const where = buildWhere("production");
        const [total, raw] = await Promise.all([
          prisma.prodProductionLog.count({ where }),
          prisma.prodProductionLog.findMany({
            where,
            orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
            skip,
            take: pageSize,
          }),
        ]);
        const data = attachLineNames(raw);
        return NextResponse.json({
          data,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          error: null,
        });
      }

      if (table === "dandori") {
        const where = buildWhere("dandori");
        const [total, raw] = await Promise.all([
          prisma.prodDandoriLog.count({ where }),
          prisma.prodDandoriLog.findMany({
            where,
            orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
            skip,
            take: pageSize,
          }),
        ]);
        const data = attachLineNames(raw);
        return NextResponse.json({
          data,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          error: null,
        });
      }

      // table === "both"
      const whereProd = buildWhere("production");
      const whereDandori = buildWhere("dandori");

      const [prodCount, dandoriCount] = await Promise.all([
        prisma.prodProductionLog.count({ where: whereProd }),
        prisma.prodDandoriLog.count({ where: whereDandori }),
      ]);
      const total = prodCount + dandoriCount;

      const fetchTake = Math.min(skip + pageSize, 500);
      const [rawProd, rawDandori] = await Promise.all([
        prisma.prodProductionLog.findMany({
          where: whereProd,
          orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
          take: fetchTake,
        }),
        prisma.prodDandoriLog.findMany({
          where: whereDandori,
          orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
          take: fetchTake,
        }),
      ]);

      const prodAttached = attachLineNames(rawProd);
      const dandoriAttached = attachLineNames(rawDandori);

      const combined = [
        ...prodAttached.map((p) => ({ ...p, _kind: "production" })),
        ...dandoriAttached.map((d) => ({ ...d, _kind: "dandori" })),
      ].sort((a, b) => new Date(b.waktu_awal).getTime() - new Date(a.waktu_awal).getTime());

      const sliced = combined.slice(skip, skip + pageSize);
      const production = sliced.filter((x) => x._kind === "production").map(({ _kind, ...rest }) => rest);
      const dandori = sliced.filter((x) => x._kind === "dandori").map(({ _kind, ...rest }) => rest);

      return NextResponse.json({
        data: { production, dandori, items: sliced },
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        error: null,
      });
    }

    const safeTake = take ? Math.min(take, 10000) : 5000;

    if (table === "production") {
      const raw = await prisma.prodProductionLog.findMany({
        where: buildWhere("production"),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: safeTake,
      });
      const data = attachLineNames(raw);
      return NextResponse.json({ data, error: null });
    }

    if (table === "dandori") {
      const raw = await prisma.prodDandoriLog.findMany({
        where: buildWhere("dandori"),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: safeTake,
      });
      const data = attachLineNames(raw);
      return NextResponse.json({ data, error: null });
    }

    // Both
    const [rawProd, rawDandori] = await Promise.all([
      prisma.prodProductionLog.findMany({
        where: buildWhere("production"),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: safeTake,
      }),
      prisma.prodDandoriLog.findMany({
        where: buildWhere("dandori"),
        orderBy: [{ waktu_awal: "desc" }, { created_at: "desc" }],
        take: safeTake,
      }),
    ]);

    const production = attachLineNames(rawProd);
    const dandori = attachLineNames(rawDandori);

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
