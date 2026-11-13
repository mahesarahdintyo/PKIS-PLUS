// app/api/produksi/downtime/route.ts
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

  // Jika format hanya YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const suffix = isEnd ? "T23:59:59.999Z" : "T00:00:00.000Z";
    const d = new Date(`${trimmed}${suffix}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Jika string sudah mengandung 'T' atau spasi (ISO atau datetime)
  if (trimmed.includes("T") || trimmed.includes(" ")) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

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
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const searchParam = searchParams.get("search") || searchParams.get("q");

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

    const where: any = {};
    const andConditions: any[] = [];

    if (isActiveStr !== "all") where.is_active = isActive;
    if (kategori && kategori !== "all") {
      if (kategori.toUpperCase() === "OTHER") {
        where.kategori = { in: ["OTHER", "other", "FORKLIFT", "forklift", "Forklift"] };
      } else {
        where.kategori = kategori;
      }
    }

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
      const matchingLineIds = allLines
        .filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
        .map((l) => l.id);

      const orConditions: any[] = [
        { problem: { contains: q, mode: "insensitive" } },
        { penyebab: { contains: q, mode: "insensitive" } },
        { countermeasure: { contains: q, mode: "insensitive" } },
        { stasiun: { contains: q, mode: "insensitive" } },
        { mesin: { contains: q, mode: "insensitive" } },
        { kategori: { contains: q, mode: "insensitive" } },
      ];
      if (matchingLineIds.length > 0) {
        orConditions.push({ line_id: { in: matchingLineIds } });
      }
      andConditions.push({ OR: orConditions });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    if (pageParam !== null) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const pageSize = Math.max(1, parseInt(pageSizeParam || limitParam || "25", 10) || 25);
      const skip = (page - 1) * pageSize;

      const [total, raw] = await Promise.all([
        prisma.prodDowntimeLog.count({ where }),
        prisma.prodDowntimeLog.findMany({
          where,
          orderBy: [
            { waktu_awal: "desc" },
            { created_at: "desc" },
          ],
          skip,
          take: pageSize,
        }),
      ]);

      const data = raw.map((r) => {
        const info = resolveLineInfo(r, allLines);
        return {
          ...r,
          line_id: info.line_id || r.line_id || null,
          line_name: info.line_name,
        };
      });

      return NextResponse.json({
        data,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        error: null,
      });
    }

    const parsedLimit = limitParam && limitParam !== "all" && limitParam !== "none"
      ? parseInt(limitParam, 10)
      : 5000;
    const safeTake = !isNaN(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 10000) : 5000;

    const raw = await prisma.prodDowntimeLog.findMany({
      where,
      orderBy: [
        { waktu_awal: "desc" },
        { created_at: "desc" },
      ],
      take: safeTake,
    });

    const data = raw.map((r) => {
      const info = resolveLineInfo(r, allLines);
      const rawKat = (r.kategori || "").toUpperCase().trim();
      const normalizedKategori = (rawKat === "FORKLIFT" || rawKat.includes("FORKLIFT")) ? "OTHER" : r.kategori;
      return {
        ...r,
        kategori: normalizedKategori,
        line_id: info.line_id || r.line_id || null,
        line_name: info.line_name,
      };
    });

    return NextResponse.json({ data, total: data.length, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/downtime]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = body.data || body;

    const rawKat = (data.kategori ?? "").toString().toUpperCase().trim();
    const normalizedKategori = (rawKat === "FORKLIFT" || rawKat.includes("FORKLIFT")) ? "OTHER" : (data.kategori ?? null);

    const res = await prisma.prodDowntimeLog.create({
      data: {
        mesin: data.mesin,
        line_id: data.line_id ?? null,
        waktu_awal: data.waktu_awal ? new Date(data.waktu_awal) : (data.start_time ? new Date(data.start_time) : new Date()),
        waktu_akhir: data.waktu_akhir ? new Date(data.waktu_akhir) : (data.end_time ? new Date(data.end_time) : new Date()),
        kategori: normalizedKategori,
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
    if (cleanData.kategori !== undefined && cleanData.kategori !== null) {
      const rawKat = cleanData.kategori.toString().toUpperCase().trim();
      if (rawKat === "FORKLIFT" || rawKat.includes("FORKLIFT")) {
        cleanData.kategori = "OTHER";
      }
    }
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
