import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import {
  getCachedLines,
  buildLineFilterConditions,
  resolveLineInfo,
} from "@/lib/services/line-filter";
import { NextResponse } from "next/server";

function formatDatePart(dateVal?: Date | string | null): string {
  if (!dateVal) return "-";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  } catch {
    return "-";
  }
}

function formatTimePart(dateVal?: Date | string | null): string {
  if (!dateVal) return "-";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

// GET - Fetch production reports with optional filtering (for operator or admin)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reqLineId = searchParams.get("lineId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const showTrash = searchParams.get("trash") === "true";

    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const lineId =
      userProfile.role === "operator" && userProfile.lineId
        ? userProfile.lineId
        : reqLineId;

    const allLines = await getCachedLines();
    const where: any = {};
    const andConditions: any[] = [];

    if (showTrash) {
      where.is_active = false;
    } else {
      where.is_active = true;
    }

    if (lineId && lineId !== "all" && lineId !== "undefined") {
      const lineConds = buildLineFilterConditions(lineId, allLines);
      if (lineConds && lineConds.length > 0) {
        andConditions.push({ OR: lineConds });
      }
    }

    const isValidDateStr = (s: string | null) =>
      !!s && s !== "undefined" && s !== "null" && s.trim() !== "";

    if (isValidDateStr(startDate) || isValidDateStr(endDate)) {
      where.waktu_awal = {};
      if (isValidDateStr(startDate)) {
        const d = new Date(`${startDate}T00:00:00.000+07:00`);
        if (!isNaN(d.getTime())) where.waktu_awal.gte = d;
      }
      if (isValidDateStr(endDate)) {
        const d = new Date(`${endDate}T23:59:59.999+07:00`);
        if (!isNaN(d.getTime())) where.waktu_awal.lte = d;
      }
    }

    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize") || searchParams.get("limit");
    const searchParam = searchParams.get("search");

    if (searchParam && searchParam.trim()) {
      const q = searchParam.trim();
      const matchingLineIds = allLines
        .filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
        .map((l) => l.id);

      const orConditions: any[] = [
        { part_number: { contains: q, mode: "insensitive" } },
        { kode: { contains: q, mode: "insensitive" } },
        { mesin: { contains: q, mode: "insensitive" } },
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
      const pageSize = Math.max(1, parseInt(pageSizeParam || "25", 10) || 25);
      const skip = (page - 1) * pageSize;

      const [total, aggRes, distinctMesin, rows] = await Promise.all([
        prisma.prodProductionLog.count({ where }),
        prisma.prodProductionLog.aggregate({
          where,
          _sum: {
            qty: true,
            ng: true,
            break_menit: true,
          },
        }),
        prisma.prodProductionLog.findMany({
          where,
          distinct: ["mesin"],
          select: { mesin: true, line_id: true },
          take: 50,
        }),
        prisma.prodProductionLog.findMany({
          where,
          orderBy: [
            { waktu_awal: "desc" },
            { created_at: "desc" },
          ],
          skip,
          take: pageSize,
        }),
      ]);

      const userIds = Array.from(
        new Set(rows.map((r: any) => r.created_by).filter(Boolean))
      ) as string[];

      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const profiles = await prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: { id: true, full_name: true },
        });
        profilesMap = Object.fromEntries(
          profiles.map((p) => [p.id, p.full_name || "-"])
        );
      }

      const mappedReports = rows.map((row: any) => {
        const lineInfo = resolveLineInfo(row, allLines);
        return {
          id: row.id,
          line_id: lineInfo.line_id || row.line_id || "",
          report_date: formatDatePart(row.waktu_awal),
          start_time: formatTimePart(row.waktu_awal),
          end_time: formatTimePart(row.waktu_akhir),
          operator_name: (row.created_by ? profilesMap[row.created_by] : null) || "-",
          part_number: row.part_number || "-",
          qty: Number(row.qty) || 0,
          ng_qty: Number(row.ng) || 0,
          break_minutes: Number(row.break_menit) || 0,
          ng_category: row.kategori_ng ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at,
          line: { name: lineInfo.line_name },
          is_active: row.is_active,
        };
      });

      const totalQty = Number(aggRes._sum.qty) || 0;
      const totalNgQty = Number(aggRes._sum.ng) || 0;
      const totalOkQty = totalQty - totalNgQty;
      const totalBreak = Number(aggRes._sum.break_menit) || 0;
      const avgNgRate = totalQty > 0 ? (totalNgQty / totalQty) * 100 : 0;
      const activeLineNames = new Set(
        distinctMesin.map((m) => resolveLineInfo(m, allLines).line_name)
      );
      const activeLinesCount = activeLineNames.size;

      return NextResponse.json({
        data: mappedReports,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        stats: {
          totalQty,
          totalOkQty,
          totalNgQty,
          avgNgRate,
          totalBreak,
          activeLinesCount,
        },
      });
    }

    const limitParam = searchParams.get("limit");
    let take: number | undefined = undefined;
    if (limitParam && limitParam !== "all" && limitParam !== "none") {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        take = parsedLimit;
      }
    }
    const safeTake = take ? Math.min(take, 10000) : 5000;

    const rows = await prisma.prodProductionLog.findMany({
      where,
      orderBy: [
        { waktu_awal: "desc" },
        { created_at: "desc" },
      ],
      take: safeTake,
    });

    const userIds = Array.from(
      new Set(rows.map((r: any) => r.created_by).filter(Boolean))
    ) as string[];

    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const profiles = await prisma.profile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true },
      });
      profilesMap = Object.fromEntries(
        profiles.map((p) => [p.id, p.full_name || "-"])
      );
    }

    const mappedReports = rows.map((row: any) => {
      const lineInfo = resolveLineInfo(row, allLines);
      return {
        id: row.id,
        line_id: lineInfo.line_id || row.line_id || "",
        report_date: formatDatePart(row.waktu_awal),
        start_time: formatTimePart(row.waktu_awal),
        end_time: formatTimePart(row.waktu_akhir),
        operator_name: (row.created_by ? profilesMap[row.created_by] : null) || "-",
        part_number: row.part_number || "-",
        qty: Number(row.qty) || 0,
        ng_qty: Number(row.ng) || 0,
        break_minutes: Number(row.break_menit) || 0,
        ng_category: row.kategori_ng ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        line: { name: lineInfo.line_name },
        is_active: row.is_active,
      };
    });

    return NextResponse.json(mappedReports);
  } catch (error: any) {
    console.error("Production reports GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Submit a new production report with updated fields
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      line_id: reqLineId,
      report_date,
      shift,
      operator_name,
      start_time,
      end_time,
      part_number,
      qty,
      ng_qty,
      ng_category,
      break_minutes,
    } = body;

    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const line_id =
      userProfile.role === "operator" && userProfile.lineId
        ? userProfile.lineId
        : reqLineId;

    if (
      !line_id ||
      !report_date ||
      !shift ||
      !operator_name ||
      !start_time ||
      !end_time ||
      !part_number ||
      typeof qty === "undefined" ||
      typeof ng_qty === "undefined" ||
      typeof break_minutes === "undefined"
    ) {
      return NextResponse.json(
        { error: "Beberapa field wajib belum terisi" },
        { status: 400 }
      );
    }

    const newReport = await prisma.productionReport.create({
      data: {
        line_id,
        report_date,
        shift,
        operator_name: operator_name.trim(),
        start_time,
        end_time,
        part_number: part_number.trim(),
        qty: parseInt(qty) || 0,
        ng_qty: parseInt(ng_qty) || 0,
        ng_category: ng_category ? ng_category.trim() : null,
        break_minutes: parseInt(break_minutes) || 0,
        is_active: true,
      },
    });

    return NextResponse.json(newReport, { status: 201 });
  } catch (error: any) {
    console.error("Production reports POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Daftar ID laporan wajib diisi" },
        { status: 400 }
      );
    }

    // Soft delete in prod_production_log and production_reports
    await prisma.prodProductionLog.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    await prisma.productionReport.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error("Production reports bulk DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

