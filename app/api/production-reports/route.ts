import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";

function formatDatePart(dateVal?: Date | string | null): string {
  if (!dateVal) return "-";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "-";
  }
}

function formatTimePart(dateVal?: Date | string | null): string {
  if (!dateVal) return "-";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
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

    const where: any = {};

    if (showTrash) {
      where.is_active = false;
    } else {
      where.OR = [{ is_active: true }, { is_active: null }];
    }

    if (lineId && lineId !== "all" && lineId !== "undefined") {
      where.line_id = lineId;
    }

    if (startDate || endDate) {
      where.waktu_awal = {};
      if (startDate) where.waktu_awal.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.waktu_awal.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const rows = await prisma.prodProductionLog.findMany({
      where,
      orderBy: [
        { waktu_awal: "desc" },
        { created_at: "desc" },
      ],
    });

    const userIds = Array.from(
      new Set(rows.map((r: any) => r.created_by).filter(Boolean))
    ) as string[];

    const lineIds = Array.from(
      new Set(rows.map((r: any) => r.line_id).filter(Boolean))
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

    let linesMap: Record<string, string> = {};
    if (lineIds.length > 0) {
      const lines = await prisma.line.findMany({
        where: { id: { in: lineIds } },
        select: { id: true, name: true },
      });
      linesMap = Object.fromEntries(lines.map((l) => [l.id, l.name]));
    }

    const mappedReports = rows.map((row: any) => ({
      id: row.id,
      line_id: row.line_id || "",
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
      line: row.line_id && linesMap[row.line_id] ? { name: linesMap[row.line_id] } : null,
      is_active: row.is_active,
    }));

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

