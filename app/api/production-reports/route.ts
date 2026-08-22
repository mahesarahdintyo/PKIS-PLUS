import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";

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
      .from("production_reports")
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

    // Filter by date range if provided
    if (startDate) {
      query = query.gte("report_date", startDate);
    }
    if (endDate) {
      query = query.lte("report_date", endDate);
    }

    const { data: reports, error } = await query
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching production reports:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(reports ?? []);
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
