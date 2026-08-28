import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";

function formatDatePart(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "-";
  }
}

function formatTimePart(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
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
    const lineId = userProfile.role === "operator" && userProfile.lineId ? userProfile.lineId : reqLineId;

    const supabase = await createClient();

    let query = supabase
      .from("prod_production_log" as any)
      .select(`
        *,
        line:lines(name)
      `);

    if (showTrash) {
      query = query.eq("is_active", false);
    } else {
      query = query.or("is_active.eq.true,is_active.is.null");
    }

    // Only filter by line if lineId is specified and is not "all"
    if (lineId && lineId !== "all" && lineId !== "undefined") {
      query = query.eq("line_id", lineId);
    }

    // Filter by date range if provided (from waktu_awal)
    if (startDate) {
      query = query.gte("waktu_awal", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("waktu_awal", `${endDate}T23:59:59.999Z`);
    }

    const { data: rows, error } = await query
      .order("waktu_awal", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching production reports:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const rawRows = (rows as any[]) ?? [];

    // Fetch operator profiles for created_by
    const userIds = Array.from(
      new Set(rawRows.map((r: any) => r.created_by).filter(Boolean))
    );
    let profilesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profiles) {
        profilesMap = Object.fromEntries(
          profiles.map((p) => [p.id, p.full_name || "-"])
        );
      }
    }

    // Map to ProductionReport shape (without shift)
    const mappedReports = rawRows.map((row: any) => ({
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
      line: row.line ? { name: row.line.name } : null,
      is_active: row.is_active,
    }));

    return NextResponse.json(mappedReports);
  } catch (error) {
    console.error("Production reports GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
    const line_id = userProfile.role === "operator" && userProfile.lineId ? userProfile.lineId : reqLineId;

    // Validate required fields
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

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("production_reports")
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating production report:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Production reports POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
